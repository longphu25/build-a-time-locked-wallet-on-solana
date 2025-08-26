import { useState, useEffect } from 'react'
import { useTimeLockedWallet } from './time-locked-wallet-data-access'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { RefreshCw } from 'lucide-react'

interface TimeLockAccount {
  publicKey: PublicKey
  account: {
    amount: { toNumber: () => number }
    unlockTimestamp: { toNumber: () => number }
    user: PublicKey
  }
}

// Real-time countdown timer component
interface CountdownTimerProps {
  unlockTimestamp: number
  onUnlock?: () => void
}

function CountdownTimer({ unlockTimestamp, onUnlock }: CountdownTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now() / 1000
      const remaining = unlockTimestamp - now
      
      if (remaining <= 0) {
        setTimeRemaining('🔓 Unlocked!')
        if (!isUnlocked) {
          setIsUnlocked(true)
          onUnlock?.()
        }
        return
      }

      const days = Math.floor(remaining / (24 * 60 * 60))
      const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60))
      const minutes = Math.floor((remaining % (60 * 60)) / 60)
      const seconds = Math.floor(remaining % 60)
      
      if (days > 0) {
        setTimeRemaining(`🔒 ${days}d ${hours}h ${minutes}m ${seconds}s`)
      } else if (hours > 0) {
        setTimeRemaining(`🔒 ${hours}h ${minutes}m ${seconds}s`)
      } else if (minutes > 0) {
        setTimeRemaining(`🔒 ${minutes}m ${seconds}s`)
      } else {
        setTimeRemaining(`🔒 ${seconds}s`)
      }
    }

    // Initial update
    updateTimer()
    
    // Update every second
    const interval = setInterval(updateTimer, 1000)
    
    return () => clearInterval(interval)
  }, [unlockTimestamp, isUnlocked, onUnlock])

  return (
    <span className={`font-mono text-sm ${isUnlocked ? 'text-green-600 font-bold' : 'text-orange-600'}`}>
      {timeRemaining}
    </span>
  )
}

// Hook to check if a timestamp is unlocked in real-time
function useIsUnlocked(timestamp: number) {
  const [isUnlocked, setIsUnlocked] = useState(false)

  useEffect(() => {
    const checkUnlock = () => {
      const now = Date.now() / 1000
      setIsUnlocked(now >= timestamp)
    }

    checkUnlock()
    const interval = setInterval(checkUnlock, 1000)
    
    return () => clearInterval(interval)
  }, [timestamp])

  return isUnlocked
}

// Individual time lock card component with real-time updates
interface TimeLockCardProps {
  lock: TimeLockAccount
  index: number
  onWithdraw: (lock: TimeLockAccount) => void
  isWithdrawing: boolean
}

function TimeLockCard({ lock, index, onWithdraw, isWithdrawing }: TimeLockCardProps) {
  const unlocked = useIsUnlocked(lock.account.unlockTimestamp.toNumber())
  const amount = lock.account.amount.toNumber() / LAMPORTS_PER_SOL

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  return (
    <Card key={`${lock.publicKey.toString()}-${index}`} className="relative">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Time Lock #{index + 1}</CardTitle>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            unlocked 
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
              : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
          }`}>
            {unlocked ? 'Unlocked' : 'Locked'}
          </span>
        </div>
        <CardDescription className="text-xs font-mono">
          PDA: {lock.publicKey.toString().slice(0, 8)}...{lock.publicKey.toString().slice(-8)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-sm text-muted-foreground">Locked Amount</Label>
          <p className="text-2xl font-bold">{amount.toFixed(3)} SOL</p>
        </div>
        
        <div>
          <Label className="text-sm text-muted-foreground">Unlock Date</Label>
          <p className="text-sm">{formatDate(lock.account.unlockTimestamp.toNumber())}</p>
        </div>

        <div>
          <Label className="text-sm text-muted-foreground">Status</Label>
          <div className="mt-1">
            <CountdownTimer 
              unlockTimestamp={lock.account.unlockTimestamp.toNumber()}
            />
          </div>
        </div>
      </CardContent>
      
      <CardFooter>
        <Button
          onClick={() => onWithdraw(lock)}
          disabled={!unlocked || isWithdrawing}
          className="w-full"
          variant={unlocked ? 'default' : 'secondary'}
        >
          {isWithdrawing 
            ? 'Withdrawing...' 
            : unlocked
            ? `Withdraw ${amount.toFixed(3)} SOL + Rent`
            : 'Locked - Cannot Withdraw Yet'
          }
        </Button>
      </CardFooter>
    </Card>
  )
}

export function TimeLockedWalletFeature() {
  const { userTimeLocks, initializeLock, withdraw, isConnected } = useTimeLockedWallet()
  const [amount, setAmount] = useState('')
  const [unlockDate, setUnlockDate] = useState('')

  const timeLocks = userTimeLocks.data || []

  // Auto-refresh logic
  useEffect(() => {
    const interval = setInterval(() => {
      userTimeLocks.refetch()
    }, 5000)

    return () => clearInterval(interval)
  }, [userTimeLocks])

  const handleInitialize = () => {
    const amountLamports = parseFloat(amount) * LAMPORTS_PER_SOL
    const unlockTimestamp = new Date(unlockDate).getTime() / 1000

    if (amountLamports <= 0 || unlockTimestamp <= Date.now() / 1000) {
      alert('Please enter a valid amount and future date')
      return
    }

    initializeLock.mutate({ amount: amountLamports, unlockTimestamp })
    
    // Clear form after submission
    setAmount('')
    setUnlockDate('')
  }

  const handleWithdraw = (timeLock: TimeLockAccount) => {
    const amount = timeLock.account.amount.toNumber()
    withdraw.mutate({ 
      amount,
      timeLockPda: timeLock.publicKey 
    })
  }

  const getTotalLocked = () => {
    return timeLocks.reduce((total, lock) => {
      return total + lock.account.amount.toNumber()
    }, 0) / LAMPORTS_PER_SOL
  }

  if (!isConnected) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Time-Locked Wallet</h2>
        <p>Please connect your wallet to use the time-locked wallet feature.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold mb-2">Time-Locked Wallet</h2>
        <p className="text-muted-foreground">
          Lock your SOL for specified periods. Create multiple time locks with different amounts and unlock times.
        </p>
        {timeLocks.length > 0 && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-lg font-semibold">
              Total Locked: {getTotalLocked().toFixed(3)} SOL
            </p>
            <p className="text-sm text-muted-foreground">
              Across {timeLocks.length} time lock{timeLocks.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={() => userTimeLocks.refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Create New Time Lock Card */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Time Lock</CardTitle>
          <CardDescription>
            Lock SOL until a specified date. Each time lock is independent and can have different amounts and unlock times.
            When you withdraw, the time lock will be closed and rent will be returned to you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount (SOL)</Label>
            <Input
              id="amount"
              type="number"
              step="0.001"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount in SOL"
            />
          </div>
          <div>
            <Label htmlFor="unlock-date">Unlock Date & Time</Label>
            <Input
              id="unlock-date"
              type="datetime-local"
              value={unlockDate}
              onChange={(e) => setUnlockDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleInitialize}
            disabled={!amount || !unlockDate || initializeLock.isPending}
            className="w-full"
          >
            {initializeLock.isPending ? 'Creating Time Lock...' : 'Create Time Lock'}
          </Button>
        </CardFooter>
      </Card>

      <div className="border-t pt-6" />

      {/* Existing Time Locks */}
      {userTimeLocks.isLoading && (
        <div className="text-center">
          <p>Loading your time locks...</p>
        </div>
      )}

      {timeLocks.length > 0 && (
        <div>
          <h3 className="text-xl font-bold mb-4">Your Time Locks</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {timeLocks.map((lock, index) => (
              <TimeLockCard
                key={`${lock.publicKey.toString()}-${index}`}
                lock={lock}
                index={index}
                onWithdraw={handleWithdraw}
                isWithdrawing={withdraw.isPending}
              />
            ))}
          </div>
        </div>
      )}

      {timeLocks.length === 0 && !userTimeLocks.isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground mb-4">
              You haven't created any time locks yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Create your first time lock above to get started!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            ℹ️ How it works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>• Each time lock is a separate account (PDA) that stores your SOL until the unlock time</p>
          <p>• You can create multiple time locks with different amounts and unlock times</p>
          <p>• When you withdraw, the time lock account is closed and the rent is returned to you</p>
          <p>• Each time lock costs ~0.002 SOL in rent (returned when withdrawn)</p>
          <p>• Time locks are non-transferable and can only be withdrawn by the original creator</p>
        </CardContent>
      </Card>
    </div>
  )
}

export default TimeLockedWalletFeature
