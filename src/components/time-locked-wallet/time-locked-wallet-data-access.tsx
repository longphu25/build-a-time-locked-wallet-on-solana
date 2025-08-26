import { getTimeLockedWalletProgram, getTimeLockedWalletProgramId, getTimeLockPda } from '@project/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Cluster, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCluster } from '@/components/cluster/cluster-data-access'
import { useAnchorProvider } from '@/components/solana/use-anchor-provider'
import { useTransactionToast } from '@/components/use-transaction-toast'
import { toast } from 'sonner'
import * as anchor from '@coral-xyz/anchor'

export function useTimeLockedWalletProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const provider = useAnchorProvider()
  
  // Map cluster network to Cluster type, defaulting to devnet for local
  const clusterNetwork = cluster.network === 'devnet' ? 'devnet' as Cluster : 
                        cluster.network === 'testnet' ? 'testnet' as Cluster :
                        cluster.network === 'mainnet-beta' ? 'mainnet-beta' as Cluster :
                        'devnet' as Cluster // Default to devnet for local/unknown clusters
  
  const programId = useMemo(() => getTimeLockedWalletProgramId(clusterNetwork), [clusterNetwork])
  const program = useMemo(() => getTimeLockedWalletProgram(provider, programId), [provider, programId])

  console.log('Program configuration:', {
    cluster: cluster.name,
    network: cluster.network,
    clusterNetwork,
    programId: programId.toString(),
    endpoint: cluster.endpoint
  })

  // Get all time locks for the current user
  const { publicKey } = useWallet()
  const userTimeLocks = useQuery({
    queryKey: ['time-locked-wallet', 'user-locks', { cluster, user: publicKey?.toString() }],
    queryFn: async () => {
      if (!publicKey) return []
      
      // Get all time lock accounts and filter by user
      const allAccounts = await program.account.timeLock.all()
      return allAccounts.filter(account => 
        account.account.user.equals(publicKey)
      )
    },
    enabled: !!publicKey,
  })

  const accounts = useQuery({
    queryKey: ['time-locked-wallet', 'all', { cluster }],
    queryFn: () => program.account.timeLock.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  return {
    program,
    programId,
    accounts,
    userTimeLocks,
    getProgramAccount,
  }
}

export function useTimeLockedWallet() {
  const { publicKey } = useWallet()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, userTimeLocks, programId } = useTimeLockedWalletProgram()

  const initializeLock = useMutation({
    mutationKey: ['time-locked-wallet', 'initialize', { cluster }],
    mutationFn: async ({ amount, unlockTimestamp }: { amount: number; unlockTimestamp: number }) => {
      if (!publicKey) throw new Error('Wallet not connected')
      
      const [timeLockPda] = getTimeLockPda(publicKey, amount, programId)
      
      console.log('Initializing time lock with:', {
        amount: amount.toString(),
        unlockTimestamp: unlockTimestamp.toString(),
        user: publicKey.toString(),
        timeLockPda: timeLockPda.toString(),
        programId: programId.toString()
      })
      
      return program.methods
        .initializeLock(new anchor.BN(amount), new anchor.BN(unlockTimestamp))
        .accountsPartial({
          user: publicKey,
          timeLock: timeLockPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      console.log('Time lock initialized successfully:', signature)
      transactionToast(signature)
      await userTimeLocks.refetch()
    },
    onError: (error) => {
      console.error('Failed to initialize time lock:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to initialize time lock: ${errorMessage}`)
    },
  })

  const withdraw = useMutation({
    mutationKey: ['time-locked-wallet', 'withdraw', { cluster }],
    mutationFn: async ({ amount, timeLockPda }: { amount: number; timeLockPda?: PublicKey }) => {
      if (!publicKey) throw new Error('Wallet not connected')
      
      // Use provided PDA or generate from amount
      const pda = timeLockPda || getTimeLockPda(publicKey, amount, programId)[0]
      
      console.log('Withdrawing from time lock:', {
        amount: amount.toString(),
        user: publicKey.toString(),
        timeLockPda: pda.toString(),
        programId: programId.toString()
      })
      
      return program.methods
        .withdraw(new anchor.BN(amount))
        .accountsPartial({
          user: publicKey,
          timeLock: pda,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      console.log('Withdrawal successful:', signature)
      transactionToast(signature)
      await userTimeLocks.refetch()
    },
    onError: (error) => {
      console.error('Failed to withdraw:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to withdraw funds: ${errorMessage}`)
    },
  })

  return {
    userTimeLocks,
    initializeLock,
    withdraw,
    isConnected: !!publicKey,
  }
}
