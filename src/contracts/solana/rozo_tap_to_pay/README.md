# Rozo Tap-to-Pay Solana Contract

This repository contains the Solana smart contract for the Rozo Tap-to-Pay system, designed to enable cryptocurrency near-field payments.

## Design Principles

Rozo Tap-to-Pay is built on three core design principles:

### 1. Openness

- **Device Agnostic**: The system supports any NFC-enabled device without proprietary hardware requirements
- **Extensible Protocol**: New wearables and form factors can easily integrate with the platform
- **Open Standards**: Built on open blockchain standards rather than closed ecosystems
- **Cross-Chain Potential**: Initial implementation on Solana with design considerations for future multi-chain support

### 2. Security

- **No Key Copying**: Private keys never leave the user's secure device
- **Prevent Double Spending**: Transaction session IDs and on-chain validation eliminate double-spend risks
- **Admin Verification**: Only authorized admin can process payments, adding an additional security layer
- **Authorization Model**: Users control exactly how much can be spent, rather than providing unlimited access
- **Zero-Knowledge Options**: Compatible with future privacy-preserving enhancements

### 3. Backwards Compatibility

- **Works with Existing Hardware**: Compatible with standard POS terminals like Square and traditional payment hardware
- **Familiar User Experience**: Mimics the tap-to-pay experience users already know from traditional payments
- **Merchant Integration**: Designed to integrate with existing merchant payment flows and accounting systems
- **Progressive Adoption**: Merchants can accept both traditional and crypto payments through the same terminal

## Features

- Users can authorize USDC allowances for their devices without needing to transfer for each payment
- Supports NFC tap-to-pay functionality, suitable for wearable devices (like CUDIS Ring)
- Admin-only payment processing for enhanced security (only authorized parties can trigger payments)
- Integrates with Solana Name Service (SNS) to display user-friendly names in transactions
- Secure fund escrow and authorization management
- Users can revoke authorization and reclaim funds at any time

## Two-Step Payment Flow

The Rozo Tap-to-Pay contract implements a two-step payment approach:

### ✅ Step 1: Wallet Authorization to Smart Contract (Setup Phase)

In this initial setup phase, the user transfers funds (e.g., $100 USDC) to a Program Derived Address (PDA) escrow account. This is a one-time operation that allows subsequent tap-to-pay transactions without requiring additional wallet signatures.

```rust
pub fn initialize_authorization(ctx: Context<InitializeAuthorization>, amount: u64) -> Result<()> {
    // Initialize escrow account
    // Transfer USDC from user to escrow account
    // Set authorized amount
}
```

### ✅ Step 2: Tap-to-Pay Flow (Deduction Phase)

When a user taps their device (e.g., CUDIS Ring) against a merchant terminal, the admin (contract deployer or designated party) triggers a smart contract call that deducts the payment amount from the user's escrow account. This admin-only approach ensures only authorized parties can process payments.

```rust
pub fn tap_to_pay(ctx: Context<TapToPay>, amount: u64, session_id: [u8; 32]) -> Result<()> {
    // Verify admin authorization
    // Verify sufficient funds
    // Transfer USDC from escrow to merchant
    // Update spent amount
}
```

## Gamification: Tap-to-Pay Leaderboard

Rozo Tap-to-Pay includes a gamification aspect through its leaderboard functionality, driving engagement and adoption:

### Key Features

- **User Rankings**: Users are ranked based on their total tap-to-pay spending
- **Merchant Categories**: Special leaderboards for different merchant categories (coffee shops, restaurants, retail)
- **Time-Based Competitions**: Weekly, monthly, and all-time leaderboards to encourage regular usage
- **Privacy-Respecting**: Users can opt in/out of leaderboards while still using the payment functionality
- **Reward Integration**: Future capability to distribute rewards to top-ranked users

### Implementation

The leaderboard tracks user spending through tap-to-pay transactions, updating rankings after each payment. Users are identified by their Solana Name Service (SNS) names when available, creating a social, community-driven experience while maintaining pseudonymity.

```rust
pub fn update_leaderboard(ctx: Context<UpdateLeaderboard>, amount: u64) -> Result<()> {
    // Update user's total spent amount
    // Re-rank users based on total spent
    // Update leaderboard state
}
```

LeaderboardEntry data structure:
```rust
pub struct LeaderboardEntry {
    pub user: Pubkey,          // User's wallet address
    pub sns_name: Option<String>, // User's SNS name (if available)
    pub total_spent: u64,      // Total amount spent via tap-to-pay
    pub transaction_count: u32, // Number of transactions
    pub rank: u16,             // Current rank in leaderboard
}
```

## Admin Role

The contract has an admin role that provides several security benefits:

1. Only the admin can trigger tap-to-pay transactions, preventing unauthorized payments
2. The admin role can be transferred to a new address if needed
3. Only registered merchants can receive payments, as authorized by the admin
4. The admin can manage and monitor all transactions

## Contract Instructions

The contract includes the following main instructions:

1. **Initialize Program** (`initialize_program`): Sets up the program with an admin (contract deployer)
2. **Update Admin** (`update_admin`): Transfers admin privileges to a new address
3. **Initialize Authorization** (`initialize_authorization`): User transfers a specific amount of USDC to the escrow account
4. **Tap to Pay** (`tap_to_pay`): Admin authorizes payment from user escrow to merchant (admin-only)
5. **Revoke Authorization** (`revoke_authorization`): User revokes unused authorization allowance and returns funds
6. **Close Escrow** (`close_escrow`): Closes the escrow account and returns remaining funds
7. **Get User Name** (`get_user_name`): Queries user's SNS name through the name service
8. **Update Leaderboard** (Future): Updates the user's position on the spending leaderboard
9. **Get Leaderboard** (Future): Retrieves the current leaderboard standings

## Account Structures

### Program State

```
ProgramState {
    admin: Pubkey,        // Admin address authorized to trigger tap-to-pay
    bump: u8,             // PDA bump seed
}
```

### Escrow Account

```
Escrow {
    owner: Pubkey,        // User's wallet address
    usdc_vault: Pubkey,   // USDC token account address
    bump: u8,             // PDA derivation seed
    allowed: u64,         // Total authorized amount
    spent: u64            // Amount already spent via tap-to-pay
}
```

### Leaderboard (Future Implementation)

```
Leaderboard {
    entries: Vec<LeaderboardEntry>, // Sorted list of users by spend amount
    last_updated: i64,             // Unix timestamp of last update
    category: String,              // Optional category (e.g., "coffee", "retail")
    time_period: TimePeriod        // Weekly, monthly, all-time
}
```

## Usage

### Admin Setup Flow

1. Deploy the contract
2. Call `initialize_program` to set the initial admin
3. (Optional) Call `update_admin` to transfer admin privileges to a production address

### User Authorization Flow

1. User connects wallet (such as Phantom, Solflare, etc.)
2. User selects authorization amount (e.g., 100 USDC)
3. Calls `initialize_authorization` to create the escrow account and transfer funds
4. Now the device can perform tap-to-pay without requiring signatures again

### Payment Flow

1. User device (like CUDIS Ring) comes close to a merchant POS terminal
2. Device transmits payment information via NFC to the merchant terminal
3. Merchant system sends transaction details to the admin backend
4. Admin calls the `tap_to_pay` instruction to process the payment
5. Contract transfers funds from escrow account to merchant account
6. If the user has an SNS name, it can be displayed on the receipt
7. User's spending is automatically tracked for leaderboard updates

### Revoking Authorization

1. User connects wallet
2. Calls the `revoke_authorization` instruction
3. Unused authorization allowance is returned to the user

### Closing the Account

1. User connects wallet
2. Calls the `close_escrow` instruction
3. Remaining USDC is returned to the user

## Development Environment Setup

### Dependencies

- Solana toolchain
- Anchor framework
- Node.js and NPM

### Installation

```bash
# Clone repository
git clone https://github.com/RozoAI/rozo-tap-to-pay.git
cd rozo-tap-to-pay/src/contracts/solana/rozo_tap_to_pay

# Install dependencies
npm install

# Build program
anchor build
```

### Testing

```bash
# Run tests
anchor test
```

### Deployment

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet

# Deploy to mainnet
anchor deploy --provider.cluster mainnet-beta
```

## SNS Name Service Integration

Rozo Tap-to-Pay supports querying and displaying the user's Solana Name Service (SNS) domain during transactions. This enables POS terminals and receipts to display user-friendly names instead of lengthy wallet addresses.

The usage example is in `examples/sns-lookup.ts`.

## Security Considerations

- This contract uses PDAs (Program Derived Addresses) to securely store funds
- Admin-only payment processing prevents unauthorized transactions
- Supports session IDs to prevent replay attacks
- Users can revoke unused authorizations at any time

## License

MIT

## Contact

For questions, please contact the project maintainer or submit a GitHub Issue. 