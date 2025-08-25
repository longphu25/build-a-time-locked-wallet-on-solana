import { AppHero } from '@/components/app-hero'

const links: { label: string; href: string }[] = [
  { label: 'Solana Docs', href: 'https://docs.solana.com/' },
  { label: 'Solana Faucet', href: 'https://faucet.solana.com/' },
  { label: 'Solana Cookbook', href: 'https://solana.com/developers/cookbook/' },
  { label: 'Solana Stack Overflow', href: 'https://solana.stackexchange.com/' },
  { label: 'Solana Developers GitHub', href: 'https://github.com/solana-developers/' },
]

export default function DashboardFeature() {
  return (
    <div>
      <AppHero title="Time-Locked Wallet" subtitle="Lock your SOL for a specified period and withdraw it after the unlock time." />
      <div className="max-w-xl mx-auto py-6 sm:px-6 lg:px-8 text-center">
        <div className="space-y-4">
          <p>A Solana smart contract that allows you to:</p>
          <ul className="list-disc list-inside space-y-2 text-left">
            <li>Deposit SOL into a time-locked account</li>
            <li>Set a future unlock timestamp</li>
            <li>Withdraw funds only after the unlock time</li>
            <li>Secure on-chain enforcement of time locks</li>
          </ul>
          <div className="pt-4">
            <a
              href="/time-locked-wallet"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md transition-colors"
            >
              Try Time-Locked Wallet
            </a>
          </div>
          
          <div className="pt-8 space-y-2">
            <p className="text-sm font-medium">Helpful Resources:</p>
            {links.map((link, index) => (
              <div key={index}>
                <a
                  href={link.href}
                  className="text-sm hover:text-gray-500 dark:hover:text-gray-300"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
