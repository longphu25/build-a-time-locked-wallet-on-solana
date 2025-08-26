# Time-Locked Wallet on Solana

A Solana smart contract and frontend application for creating time-locked wallets where users can deposit SOL and set an unlock timestamp for future withdrawal.

## Features

- **Time-Locked Deposits**: Lock SOL until a specified unlock timestamp
- **Secure Withdrawals**: Only withdraw after the unlock time has passed
- **User-Friendly Interface**: Clean React frontend with wallet integration
- **Real-Time Status**: Display locked amount, unlock date, and countdown timer
- **Devnet Deployment**: Fully deployed and tested on Solana devnet

## Live Demo

- **Program ID**: `G9C4ivjLy46CfRH8wbxBLDX4eSunQaZopoiSK2E9LymC`
- **Network**: Solana Devnet
- **Frontend**: Run locally (instructions below)

## Project Structure

```
├── anchor/                 # Solana program (Rust/Anchor)
│   ├── programs/
│   │   └── time-locked-wallet/
│   │       └── src/lib.rs  # Main program logic
│   ├── tests/              # Program tests
│   └── Anchor.toml         # Anchor configuration
├── src/                    # React frontend
│   ├── components/
│   │   └── time-locked-wallet/  # Wallet components
│   └── main.tsx           # App entry point
└── README.md              # This file
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Rust](https://rustup.rs/) and [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor Framework](https://www.anchor-lang.com/docs/installation)
- [Phantom](https://phantom.app/) or [Backpack](https://backpack.app/) wallet

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd build-a-time-locked-wallet-on-solana
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Install Anchor dependencies**
   ```bash
   cd anchor
   npm install
   cd ..
   ```

## Running the Application

### Option 1: Use Deployed Program (Recommended)

The program is already deployed on Solana devnet. You can use it immediately:

1. **Start the frontend**
   ```bash
   npm run dev
   ```

2. **Open your browser**
   - Navigate to `http://localhost:5173`
   - Connect your wallet (make sure it's set to Devnet)
   - Start using the time-locked wallet!

### Option 2: Deploy Your Own Program

If you want to deploy your own instance:

1. **Configure Solana CLI for devnet**
   ```bash
   solana config set --url devnet
   ```

2. **Generate a new wallet (if needed)**
   ```bash
   solana-keygen new --outfile ~/.config/solana/id.json
   ```

3. **Get devnet SOL**
   ```bash
   solana airdrop 2
   ```

4. **Build and deploy the program**
   ```bash
   cd anchor
   anchor build
   anchor deploy
   ```

5. **Update program ID in frontend**
   - Copy the new program ID from the deploy output
   - Update `anchor/src/time-locked-wallet-exports.ts` with your new program ID

6. **Start the frontend**
   ```bash
   cd ..
   npm run dev
   ```

## How to Use

### Creating a Time-Locked Wallet

1. **Connect your wallet** to the application
2. **Enter the amount** of SOL you want to lock
3. **Set the unlock date** (must be in the future)
4. **Click "Lock SOL"** to create the time-locked wallet
5. **Confirm the transaction** in your wallet

### Withdrawing Funds

1. **Wait** until the unlock time has passed
2. **Click "Withdraw SOL"** button (only available after unlock time)
3. **Confirm the transaction** in your wallet
4. **Funds** will be transferred back to your wallet

## Program Instructions

### `initialize_lock(amount, unlock_timestamp)`
- Locks the specified amount of SOL until the unlock timestamp
- Creates a PDA account to hold the locked funds
- Validates that unlock timestamp is in the future

### `withdraw()`
- Allows withdrawal of locked funds after unlock time
- Validates that the unlock time has passed
- Transfers funds back to the original depositor

## Technical Details

### Smart Contract (Anchor Program)

**Location**: `anchor/programs/time-locked-wallet/src/lib.rs`

**Key Features**:
- Program-Derived Address (PDA) for secure fund storage
- Time-based unlock mechanism using Solana's Clock sysvar
- Protection against premature withdrawals
- Single-use withdrawal protection

**Account Structure**:
```rust
pub struct TimeLock {
    pub user: Pubkey,           // Original depositor
    pub amount: u64,            // Locked amount in lamports
    pub unlock_timestamp: i64,  // Unix timestamp for unlock
}
```

### Frontend (React + TypeScript)

**Location**: `src/components/time-locked-wallet/`

**Key Features**:

- Wallet connection with Phantom/Backpack support
- Form for creating time-locked deposits
- Real-time countdown timer until unlock
- Withdraw functionality with time validation
- Transaction status feedback

**Components**:

- `time-locked-wallet-feature.tsx` - Main UI component
- `time-locked-wallet-data-access.tsx` - Program interaction logic

## Testing

### Run Program Tests

```bash
cd anchor
anchor test
```

### Manual Testing Steps

1. **Connect wallet** and ensure you're on Devnet
2. **Create a time lock** with a short unlock time (e.g., 1 minute)
3. **Verify** that withdrawal fails before unlock time
4. **Wait** for unlock time to pass
5. **Verify** successful withdrawal after unlock time

## Development Commands

### Anchor Program Commands

```bash
cd anchor

# Build the program
anchor build

# Test the program
anchor test

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Check program logs
solana logs <PROGRAM_ID>
```

### Frontend Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run type checking
npm run type-check
```

## Troubleshooting

### Common Issues

1. **"Failed to initialize time lock"**
   - Ensure your wallet is connected to Devnet
   - Check that you have sufficient SOL for transaction fees
   - Verify the unlock time is in the future

2. **Transaction fails**
   - Check browser console for detailed error messages
   - Ensure you have enough SOL for gas fees (0.001 SOL minimum)
   - Try refreshing the page and reconnecting wallet

3. **Program not found**
   - Verify you're connected to the correct network (Devnet)
   - Check that the program ID matches the deployed program

### Getting Help

- Check browser console for detailed error logs
- Review Solana transaction logs using [Solana Explorer](https://explorer.solana.com/)
- Ensure wallet is set to Devnet network

## New Features

### Refresh Button and Auto-Refresh

- **Manual Refresh**: A refresh button has been added to the UI, allowing users to manually update the list of time locks.

- **Auto-Refresh**: The list of time locks now automatically refreshes every 5 seconds, ensuring real-time updates without user intervention.

### Enhanced User Experience

- **Real-Time Countdown Timer**: Displays the time remaining until unlock for each time lock.

- **Improved Status Indicators**: Clear visual indicators for locked and unlocked states.

### How to Use the Refresh Feature

1. **Manual Refresh**: Click the "Refresh" button in the top-right corner of the time lock list.

2. **Auto-Refresh**: The list updates automatically every 5 seconds.

These features enhance the usability and responsiveness of the application, providing a seamless experience for managing time-locked wallets.

## Project Architecture

```text
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React App     │────│  Anchor Client   │────│ Solana Program  │
│                 │    │                  │    │                 │
│ - UI Components │    │ - RPC calls      │    │ - Time locks    │
│ - Wallet integration    │ - Account management   │ - Withdrawals   │
│ - Transaction handling  │ - Program invocation   │ - Validation    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                          ┌───────▼────────┐
                          │ Solana Devnet  │
                          │                │
                          │ - Program PDAs │
                          │ - User accounts│
                          │ - Transactions │
                          └────────────────┘
```

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**Built for the Solana Hackathon** 🚀
