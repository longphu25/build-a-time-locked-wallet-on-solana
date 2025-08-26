// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import TimeLockedWalletIDL from '../target/idl/time_locked_wallet.json'
import type { TimeLockedWallet } from '../target/types/time_locked_wallet'

// Re-export the generated IDL and type
export { TimeLockedWallet, TimeLockedWalletIDL }

// The programId is imported from the program IDL.
export const TIME_LOCKED_WALLET_PROGRAM_ID = new PublicKey(TimeLockedWalletIDL.address)

// This is a helper function to get the TimeLockedWallet Anchor program.
export function getTimeLockedWalletProgram(provider: AnchorProvider, address?: PublicKey): Program<TimeLockedWallet> {
  return new Program({ ...TimeLockedWalletIDL, address: address ? address.toBase58() : TimeLockedWalletIDL.address } as TimeLockedWallet, provider)
}

// This is a helper function to get the program ID for the TimeLockedWallet program depending on the cluster.
export function getTimeLockedWalletProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet':
    case 'testnet':
      // This is the program ID for the TimeLockedWallet program on devnet and testnet.
      return new PublicKey('AMEdHNwAUw2eBkm26Pwn2aePe6bQ7Vgzjeavx3uNvkGn')
    case 'mainnet-beta':
    default:
      return TIME_LOCKED_WALLET_PROGRAM_ID
  }
}

// Helper function to derive the time lock PDA for a user with a specific amount
export function getTimeLockPda(
  userPublicKey: PublicKey,
  amount: number,
  programId: PublicKey = TIME_LOCKED_WALLET_PROGRAM_ID
): [PublicKey, number] {
  // Convert amount to little-endian bytes (8 bytes for u64)
  const amountBuffer = Buffer.alloc(8);
  amountBuffer.writeBigUInt64LE(BigInt(amount), 0);
  
  return PublicKey.findProgramAddressSync(
    [Buffer.from('time_lock'), userPublicKey.toBuffer(), amountBuffer],
    programId
  );
}

// Helper function to get all user's time locks
export function getUserTimeLockPdas(
  userPublicKey: PublicKey,
  amounts: number[],
  programId: PublicKey = TIME_LOCKED_WALLET_PROGRAM_ID
): Array<{ amount: number; pda: PublicKey; bump: number }> {
  return amounts.map(amount => {
    const [pda, bump] = getTimeLockPda(userPublicKey, amount, programId);
    return { amount, pda, bump };
  });
}
