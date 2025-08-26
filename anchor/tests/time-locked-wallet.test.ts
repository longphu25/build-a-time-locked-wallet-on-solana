import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { TimeLockedWallet } from "../target/types/time_locked_wallet";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

describe("Time Locked Wallet", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TimeLockedWallet as Program<TimeLockedWallet>;
  const provider = anchor.getProvider();

  let user: Keypair;

  beforeEach(async () => {
    // Create a new user for each test
    user = Keypair.generate();
    
    // Airdrop SOL to the user
    const signature = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
  });

  describe("Initialize Lock", () => {
    it("should initialize a time lock successfully", async () => {
      const amount = 0.5 * LAMPORTS_PER_SOL; // 0.5 SOL
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 3600); // 1 hour from now

      // Derive PDA with amount in seeds (using little-endian bytes)
      const [timeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      console.log("Transaction signature:", await program.methods
        .initializeLock(new anchor.BN(amount), unlockTimestamp)
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc());

      // Fetch the time lock account
      const timeLockAccount = await program.account.timeLock.fetch(timeLockPda);

      // Verify the account was initialized correctly
      expect(timeLockAccount.user.toString()).toBe(user.publicKey.toString());
      expect(timeLockAccount.amount.toNumber()).toBe(amount);
      expect(timeLockAccount.unlockTimestamp.toNumber()).toBe(unlockTimestamp.toNumber());

      // Verify the PDA received the funds
      const timeLockBalance = await provider.connection.getBalance(timeLockPda);
      expect(timeLockBalance).toBeGreaterThan(amount); // Should be amount + rent
    });

    it("should fail when unlock timestamp is in the past", async () => {
      const amount = 0.5 * LAMPORTS_PER_SOL;
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 - 3600); // 1 hour ago

      // Derive PDA with amount in seeds
      const [timeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .initializeLock(new anchor.BN(amount), unlockTimestamp)
          .accountsPartial({
            user: user.publicKey,
            timeLock: timeLockPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();
        
        fail("Expected transaction to fail");
      } catch (error) {
        expect(error.message).toMatch(/Unlock timestamp must be in the future/);
      }
    });

    it("should fail when user has insufficient funds", async () => {
      const amount = 10 * LAMPORTS_PER_SOL; // More than airdropped amount
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 3600);

      // Derive PDA with amount in seeds
      const [timeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      try {
        await program.methods
          .initializeLock(new anchor.BN(amount), unlockTimestamp)
          .accountsPartial({
            user: user.publicKey,
            timeLock: timeLockPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([user])
          .rpc();
        
        fail("Expected transaction to fail");
      } catch (error) {
        expect(error.message).toMatch(/insufficient/);
      }
    });
  });

  describe("Withdraw", () => {
    let amount: number;

    beforeEach(async () => {
      amount = 0.5 * LAMPORTS_PER_SOL;

      // Derive PDA with amount in seeds
      const [timeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Initialize the time lock first
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 1); // 1 second from now

      await program.methods
        .initializeLock(new anchor.BN(amount), unlockTimestamp)
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Wait for the unlock time to pass
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    it("should withdraw funds successfully after unlock time", async () => {
      // Derive PDA with amount in seeds
      const [timeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const userBalanceBeforeWithdraw = await provider.connection.getBalance(user.publicKey);
      const timeLockBalanceBeforeWithdraw = await provider.connection.getBalance(timeLockPda);

      // Directly log the transaction signature
      console.log("Withdraw transaction signature:", await program.methods
        .withdraw(new anchor.BN(amount))
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda,
        })
        .signers([user])
        .rpc());

      // Verify the PDA is closed (account should not exist)
      try {
        await program.account.timeLock.fetch(timeLockPda);
        fail("Expected PDA to be closed");
      } catch (error) {
        expect(error.message).toMatch(/Account does not exist|AccountNotInitialized/);
      }

      // Verify user received the funds back (minus transaction fees)
      const userBalanceAfterWithdraw = await provider.connection.getBalance(user.publicKey);
      expect(userBalanceAfterWithdraw).toBeGreaterThan(userBalanceBeforeWithdraw);
      
      // The user should have received the locked amount plus the rent
      const expectedIncrease = timeLockBalanceBeforeWithdraw;
      expect(userBalanceAfterWithdraw - userBalanceBeforeWithdraw).toBeCloseTo(expectedIncrease, -4); // Allow for some transaction fees
    });

    it("should fail to withdraw before unlock time", async () => {
      const futureAmount = 0.3 * LAMPORTS_PER_SOL; // Different amount for this test
      const futureUnlockTimestamp = new anchor.BN(Date.now() / 1000 + 3600); // 1 hour from now

      // Derive PDA with amount in seeds
      const [timeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(futureAmount).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      await program.methods
        .initializeLock(new anchor.BN(futureAmount), futureUnlockTimestamp)
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      try {
        await program.methods
          .withdraw(new anchor.BN(futureAmount))
          .accountsPartial({
            user: user.publicKey,
            timeLock: timeLockPda,
          })
          .signers([user])
          .rpc();

        fail("Expected transaction to fail");
      } catch (error) {
        expect(error.message).toMatch(/Funds are still locked/);
      }
    });

    it("should fail to withdraw twice", async () => {
      // Derive PDA with amount in seeds
      const [timeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // First withdrawal
      await program.methods
        .withdraw(new anchor.BN(amount))
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda,
        })
        .signers([user])
        .rpc();

      // Second withdrawal should fail because the PDA no longer exists
      try {
        await program.methods
          .withdraw(new anchor.BN(amount))
          .accountsPartial({
            user: user.publicKey,
            timeLock: timeLockPda,
          })
          .signers([user])
          .rpc();

        fail("Expected transaction to fail");
      } catch (error) {
        // The PDA should no longer exist, so this should fail with account not found error
        expect(error.message).toMatch(/Account does not exist|AccountNotFound|already been closed|AccountNotInitialized/);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle minimum amount (1 lamport)", async () => {
      const amount = 1; // 1 lamport
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 1);

      // Derive PDA with amount in seeds
      const [timeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      console.log("Transaction signature:", await program.methods
        .initializeLock(new anchor.BN(amount), unlockTimestamp)
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc());

      const timeLockAccount = await program.account.timeLock.fetch(timeLockPda);
      expect(timeLockAccount.amount.toNumber()).toBe(amount);
    });

    it("should handle very far future unlock time", async () => {
      const amount = 0.1 * LAMPORTS_PER_SOL;
      const unlockTimestamp = new anchor.BN(Date.now() / 1000 + 31536000); // 1 year from now

      // Derive PDA with amount in seeds
      const [timeLockPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      console.log("Transaction signature:", await program.methods
        .initializeLock(new anchor.BN(amount), unlockTimestamp)
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc());

      const timeLockAccount = await program.account.timeLock.fetch(timeLockPda);
      expect(timeLockAccount.unlockTimestamp.toNumber()).toBe(unlockTimestamp.toNumber());
    });
  });

  describe("Multiple Time Locks", () => {
    it("should allow creating multiple time locks with different amounts", async () => {
      const amount1 = 0.5 * LAMPORTS_PER_SOL;
      const amount2 = 1 * LAMPORTS_PER_SOL;
      const unlockTimestamp1 = new anchor.BN(Date.now() / 1000 + 3600); // 1 hour from now
      const unlockTimestamp2 = new anchor.BN(Date.now() / 1000 + 7200); // 2 hours from now

      const [timeLockPda1] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount1).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [timeLockPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount2).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Initialize first time lock
      await program.methods
        .initializeLock(new anchor.BN(amount1), unlockTimestamp1)
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda1,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Initialize second time lock
      await program.methods
        .initializeLock(new anchor.BN(amount2), unlockTimestamp2)
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda2,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Fetch and verify both time locks
      const timeLockAccount1 = await program.account.timeLock.fetch(timeLockPda1);
      expect(timeLockAccount1.amount.toNumber()).toBe(amount1);
      expect(timeLockAccount1.unlockTimestamp.toNumber()).toBe(unlockTimestamp1.toNumber());

      const timeLockAccount2 = await program.account.timeLock.fetch(timeLockPda2);
      expect(timeLockAccount2.amount.toNumber()).toBe(amount2);
      expect(timeLockAccount2.unlockTimestamp.toNumber()).toBe(unlockTimestamp2.toNumber());
    });

    it("should allow withdrawing from one time lock without affecting others", async () => {
      const amount1 = 0.5 * LAMPORTS_PER_SOL;
      const amount2 = 1 * LAMPORTS_PER_SOL;
      const unlockTimestamp1 = new anchor.BN(Date.now() / 1000 + 1); // 1 second from now
      const unlockTimestamp2 = new anchor.BN(Date.now() / 1000 + 7200); // 2 hours from now

      const [timeLockPda1] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount1).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      const [timeLockPda2] = PublicKey.findProgramAddressSync(
        [Buffer.from("time_lock"), user.publicKey.toBuffer(), new anchor.BN(amount2).toArrayLike(Buffer, "le", 8)],
        program.programId
      );

      // Initialize both time locks
      await program.methods
        .initializeLock(new anchor.BN(amount1), unlockTimestamp1)
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda1,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      await program.methods
        .initializeLock(new anchor.BN(amount2), unlockTimestamp2)
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda2,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      // Wait for the first unlock time to pass
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Withdraw from the first time lock
      await program.methods
        .withdraw(new anchor.BN(amount1))
        .accountsPartial({
          user: user.publicKey,
          timeLock: timeLockPda1,
        })
        .signers([user])
        .rpc();

      // Verify the first time lock PDA is closed (account should not exist)
      try {
        await program.account.timeLock.fetch(timeLockPda1);
        fail("Expected PDA to be closed");
      } catch (error) {
        expect(error.message).toMatch(/Account does not exist|AccountNotInitialized/);
      }

      // Verify the second time lock is unaffected
      const timeLockAccount2 = await program.account.timeLock.fetch(timeLockPda2);
      expect(timeLockAccount2.amount.toNumber()).toBe(amount2);
    });
  });
});

