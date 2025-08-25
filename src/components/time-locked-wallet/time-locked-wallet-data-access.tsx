import { getTimeLockedWalletProgram, getTimeLockedWalletProgramId, getTimeLockPda } from '@project/anchor'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { Cluster } from '@solana/web3.js'
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
    getProgramAccount,
  }
}

export function useTimeLockedWallet() {
  const { publicKey } = useWallet()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, accounts, programId } = useTimeLockedWalletProgram()

  const timeLockPda = useMemo(() => {
    if (!publicKey) return null
    return getTimeLockPda(publicKey, programId)[0]
  }, [publicKey, programId])

  const timeLockQuery = useQuery({
    queryKey: ['time-locked-wallet', 'fetch', { cluster, account: timeLockPda?.toString() }],
    queryFn: async () => {
      if (!timeLockPda) throw new Error('No time lock PDA')
      try {
        return await program.account.timeLock.fetch(timeLockPda)
      } catch {
        // Return null if account doesn't exist
        return null
      }
    },
    enabled: !!timeLockPda,
  })

  const initializeLock = useMutation({
    mutationKey: ['time-locked-wallet', 'initialize', { cluster }],
    mutationFn: async ({ amount, unlockTimestamp }: { amount: number; unlockTimestamp: number }) => {
      if (!publicKey || !timeLockPda) throw new Error('Wallet not connected')
      
      console.log('Initializing time lock with:', {
        amount: amount.toString(),
        unlockTimestamp: unlockTimestamp.toString(),
        user: publicKey.toString(),
        timeLockPda: timeLockPda.toString(),
        programId: programId.toString()
      })
      
      return program.methods
        .initializeLock(new anchor.BN(amount), new anchor.BN(unlockTimestamp))
        .accounts({
          user: publicKey,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      console.log('Time lock initialized successfully:', signature)
      transactionToast(signature)
      await accounts.refetch()
      await timeLockQuery.refetch()
    },
    onError: (error) => {
      console.error('Failed to initialize time lock:', error)
      // Extract more specific error message if available
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to initialize time lock: ${errorMessage}`)
    },
  })

  const withdraw = useMutation({
    mutationKey: ['time-locked-wallet', 'withdraw', { cluster }],
    mutationFn: async () => {
      if (!publicKey || !timeLockPda) throw new Error('Wallet not connected')
      
      console.log('Withdrawing from time lock:', {
        user: publicKey.toString(),
        timeLockPda: timeLockPda.toString(),
        programId: programId.toString()
      })
      
      return program.methods
        .withdraw()
        .accounts({
          user: publicKey,
        })
        .rpc()
    },
    onSuccess: async (signature) => {
      console.log('Withdrawal successful:', signature)
      transactionToast(signature)
      await accounts.refetch()
      await timeLockQuery.refetch()
    },
    onError: (error) => {
      console.error('Failed to withdraw:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      toast.error(`Failed to withdraw funds: ${errorMessage}`)
    },
  })

  return {
    timeLockQuery,
    initializeLock,
    withdraw,
    timeLockPda,
    isConnected: !!publicKey,
  }
}
