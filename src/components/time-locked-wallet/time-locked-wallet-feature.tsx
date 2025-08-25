import { useState } from 'react'
import { useTimeLockedWallet } from './time-locked-wallet-data-access'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

export function TimeLockedWalletFeature() {
  const { publicKey } = useWallet()
  const { timeLockQuery, initializeLock, withdraw, isConnected } = useTimeLockedWallet()
  const [amount, setAmount] = useState('')
  const [unlockDate, setUnlockDate] = useState('')

  const timeLockData = timeLockQuery.data

  const handleInitialize = () => {
    const amountLamports = parseFloat(amount) * LAMPORTS_PER_SOL
    const unlockTimestamp = new Date(unlockDate).getTime() / 1000

    if (amountLamports <= 0 || unlockTimestamp <= Date.now() / 1000) {
      alert('Please enter a valid amount and future date')
      return
    }

    initializeLock.mutate({ amount: amountLamports, unlockTimestamp })
  }

  const handleWithdraw = () => {
    withdraw.mutate()
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString()
  }

  const isUnlocked = (timestamp: number) => {
    return Date.now() / 1000 >= timestamp
  }

  const getTimeRemaining = (timestamp: number) => {
    const now = Date.now() / 1000
    const remaining = timestamp - now
    
    if (remaining <= 0) return 'Unlocked!'
    
    const days = Math.floor(remaining / (24 * 60 * 60))
    const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((remaining % (60 * 60)) / 60)
    
    return `${days}d ${hours}h ${minutes}m remaining`
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
          Lock your SOL for a specified period and withdraw it after the unlock time.
        </p>
      </div>

      {!timeLockData ? (
        <Card>
          <CardHeader>
            <CardTitle>Create Time-Locked Wallet</CardTitle>
            <CardDescription>
              Lock your SOL until a specified date. Once locked, you cannot withdraw until the unlock time.
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
              {initializeLock.isPending ? 'Creating...' : 'Lock SOL'}
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your Time-Locked Wallet</CardTitle>
            <CardDescription>
              Wallet Address: {publicKey?.toString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Locked Amount</Label>
                <p className="text-2xl font-bold">
                  {(timeLockData.amount.toNumber() / LAMPORTS_PER_SOL).toFixed(3)} SOL
                </p>
              </div>
              <div>
                <Label>Status</Label>
                <p className={`text-2xl font-bold ${timeLockData.isWithdrawn ? 'text-gray-500' : isUnlocked(timeLockData.unlockTimestamp.toNumber()) ? 'text-green-600' : 'text-orange-600'}`}>
                  {timeLockData.isWithdrawn ? 'Withdrawn' : isUnlocked(timeLockData.unlockTimestamp.toNumber()) ? 'Unlocked' : 'Locked'}
                </p>
              </div>
            </div>
            
            <div>
              <Label>Unlock Date</Label>
              <p className="text-lg">{formatDate(timeLockData.unlockTimestamp.toNumber())}</p>
            </div>

            {!timeLockData.isWithdrawn && (
              <div>
                <Label>Time Remaining</Label>
                <p className="text-lg font-medium">
                  {getTimeRemaining(timeLockData.unlockTimestamp.toNumber())}
                </p>
              </div>
            )}
          </CardContent>
          
          {!timeLockData.isWithdrawn && (
            <CardFooter>
              <Button
                onClick={handleWithdraw}
                disabled={
                  !isUnlocked(timeLockData.unlockTimestamp.toNumber()) || 
                  withdraw.isPending ||
                  timeLockData.isWithdrawn
                }
                className="w-full"
                variant={isUnlocked(timeLockData.unlockTimestamp.toNumber()) ? 'default' : 'secondary'}
              >
                {withdraw.isPending 
                  ? 'Withdrawing...' 
                  : isUnlocked(timeLockData.unlockTimestamp.toNumber())
                  ? 'Withdraw SOL'
                  : 'Locked - Cannot Withdraw Yet'
                }
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {timeLockQuery.isLoading && (
        <div className="text-center">
          <p>Loading your time-locked wallet...</p>
        </div>
      )}
    </div>
  )
}

export default TimeLockedWalletFeature
