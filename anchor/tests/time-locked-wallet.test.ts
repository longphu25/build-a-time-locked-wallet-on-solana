import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TimeLockedWallet } from "../target/types/time_locked_wallet";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("Time Locked Wallet", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TimeLockedWallet as Program<TimeLockedWallet>;
  const provider = anchor.getProvider();

  let user: Keypair;
  let timeLockPda: PublicKey;

  beforeEach(async () => {
    // Create a new user for each test
    user = Keypair.generate();
    
    // Airdrop SOL to the user
    const signature = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Find the PDA for the time lock account
    [timeLockPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("time_lock"), user.publicKey.toBuffer()],
      program.programId
    );
  });

  describe("Initialize Lock", () => {
    it("should initialize a time lock successfully", async () => {
      const amount = 0.5 * LAMPORTS_PER_SOL; // 0.5 SOL
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 3600); // 1 hour from now

      const tx = await program.methods
        .initializeLock(new anchor.BN(amount), unlockTimestamp)
        .accounts({
          user: user.publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      console.log("Initialize transaction signature:", tx);

      // Fetch the time lock account
      const timeLockAccount = await program.account.timeLock.fetch(timeLockPda);

      // Verify the account was initialized correctly
      expect(timeLockAccount.user.toString()).to.equal(user.publicKey.toString());
      expect(timeLockAccount.amount.toNumber()).to.equal(amount);
      expect(timeLockAccount.unlockTimestamp.toNumber()).to.equal(unlockTimestamp.toNumber());
      expect(timeLockAccount.isWithdrawn).to.be.false;

      // Verify the PDA received the funds
      const timeLockBalance = await provider.connection.getBalance(timeLockPda);
      expect(timeLockBalance).to.be.greaterThan(amount); // Should be amount + rent
    });

    it("should fail when unlock timestamp is in the past", async () => {
      const amount = 0.5 * LAMPORTS_PER_SOL;
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 - 3600); // 1 hour ago

      try {
        await program.methods
          .initializeLock(new anchor.BN(amount), unlockTimestamp)
          .accounts({
            user: user.publicKey,
            timeLock: timeLockPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected transaction to fail");
      } catch (error) {
        expect(error.error.errorMessage).to.include("Unlock timestamp must be in the future");
      }
    });

    it("should fail when user has insufficient funds", async () => {
      const amount = 10 * LAMPORTS_PER_SOL; // More than airdropped amount
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 3600);

      try {
        await program.methods
          .initializeLock(new anchor.BN(amount), unlockTimestamp)
          .accounts({
            user: user.publicKey,
            timeLock: timeLockPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected transaction to fail");
      } catch (error) {
        expect(error.message).to.include("insufficient");
      }
    });
  });

  describe("Withdraw", () => {
    let amount: number;
    let userInitialBalance: number;

    beforeEach(async () => {
      amount = 0.5 * LAMPORTS_PER_SOL;
      userInitialBalance = await provider.connection.getBalance(user.publicKey);
      
      // Initialize the time lock first
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 1); // 1 second from now
      
      await program.methods
        .initializeLock(new anchor.BN(amount), unlockTimestamp)
        .accounts({
          user: user.publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Wait for the unlock time to pass
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    it("should withdraw funds successfully after unlock time", async () => {
      const userBalanceBeforeWithdraw = await provider.connection.getBalance(user.publicKey);
      
      const tx = await program.methods
        .withdraw()
        .accounts({
          user: user.publicKey,
          timeLock: timeLockPda,
        })
        .signers([user])
        .rpc();

      console.log("Withdraw transaction signature:", tx);

      // Fetch the time lock account
      const timeLockAccount = await program.account.timeLock.fetch(timeLockPda);
      expect(timeLockAccount.isWithdrawn).to.be.true;

      // Verify user received the funds back (minus transaction fees)
      const userBalanceAfterWithdraw = await provider.connection.getBalance(user.publicKey);
      expect(userBalanceAfterWithdraw).to.be.greaterThan(userBalanceBeforeWithdraw);
    });

    it("should fail to withdraw before unlock time", async () => {
      // Create a new time lock with future unlock time
      const newUser = Keypair.generate();
      await provider.connection.requestAirdrop(newUser.publicKey, 2 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for airdrop

      const [newTimeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), newUser.publicKey.toBuffer()],
        program.programId
      );

      const futureUnlockTimestamp = new anchor.BN(Date.now() / 1000 + 3600); // 1 hour from now
      
      await program.methods
        .initializeLock(new anchor.BN(amount), futureUnlockTimestamp)
        .accounts({
          user: newUser.publicKey,
          timeLock: newTimeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([newUser])
        .rpc();

      try {
        await program.methods
          .withdraw()
          .accounts({
            user: newUser.publicKey,
            timeLock: newTimeLockPda,
          })
          .signers([newUser])
          .rpc();
        
        expect.fail("Expected transaction to fail");
      } catch (error) {
        expect(error.error.errorMessage).to.include("Funds are still locked");
      }
    });

    it("should fail to withdraw twice", async () => {
      // First withdrawal
      await program.methods
        .withdraw()
        .accounts({
          user: user.publicKey,
          timeLock: timeLockPda,
        })
        .signers([user])
        .rpc();

      // Second withdrawal should fail
      try {
        await program.methods
          .withdraw()
          .accounts({
            user: user.publicKey,
            timeLock: timeLockPda,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected transaction to fail");
      } catch (error) {
        expect(error.error.errorMessage).to.include("Funds have already been withdrawn");
      }
    });

    it("should fail when unauthorized user tries to withdraw", async () => {
      const unauthorizedUser = Keypair.generate();
      await provider.connection.requestAirdrop(unauthorizedUser.publicKey, LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for airdrop

      try {
        await program.methods
          .withdraw()
          .accounts({
            user: unauthorizedUser.publicKey,
            timeLock: timeLockPda,
          })
          .signers([unauthorizedUser])
          .rpc();
        
        expect.fail("Expected transaction to fail");
      } catch (error) {
        expect(error.error.errorMessage).to.include("You are not authorized to withdraw from this time lock");
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle minimum amount (1 lamport)", async () => {
      const amount = 1; // 1 lamport
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 1);

      const tx = await program.methods
        .initializeLock(new anchor.BN(amount), unlockTimestamp)
        .accounts({
          user: user.publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      const timeLockAccount = await program.account.timeLock.fetch(timeLockPda);
      expect(timeLockAccount.amount.toNumber()).to.equal(amount);
    });

    it("should handle very far future unlock time", async () => {
      const amount = 0.1 * LAMPORTS_PER_SOL;
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 31536000); // 1 year from now

      const tx = await program.methods
        .initializeLock(new anchor.BN(amount), unlockTimestamp)
        .accounts({
          user: user.publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      const timeLockAccount = await program.account.timeLock.fetch(timeLockPda);
      expect(timeLockAccount.unlockTimestamp.toNumber()).to.equal(unlockTimestamp.toNumber());
    });
  });
});
