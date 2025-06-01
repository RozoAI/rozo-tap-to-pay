# Rozo Tap to Pay
Crypto Native Tap to Pay Between Mobile, Wearables and POS

A Solana smart contract built with the Anchor framework that enables tap-to-pay functionality for token payments.

## Features

- **Token Authorization**: Users can authorize tokens (e.g., USDC) to be spent by the contract
- **Merchant Whitelisting**: Contract owners can whitelist merchant addresses
- **Secure Payments**: Only authorized owners can trigger payments from users to merchants
- **User Control**: Tokens remain in the user's wallet until payment is processed

## Architecture

The contract uses Program Derived Addresses (PDAs) to store various states:

1. **Program Config**: Stores the contract authority (deployer)
2. **Owner Accounts**: Stores owner addresses that have admin privileges
3. **Merchant Accounts**: Stores whitelisted merchant addresses
4. **Payment Auth**: Stores the amount of tokens a user has authorized for payments

## Prerequisites

- Solana CLI tools
- Anchor Framework
- Node.js and npm/yarn
- Rust and Cargo

## Getting Started

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/rozo-tap-to-pay.git
   cd rozo-tap-to-pay
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Generate Solana accounts (deployer and user):
   ```
   npm run generate-accounts
   ```
   This script will:
   - Generate Solana keypairs for deployer and user
   - Save them to the `keys/` directory
   - Create a `.env` file with the paths to these keypairs

4. Fund your accounts with SOL (on devnet):
   ```
   npm run fund-accounts
   ```
   This requires the Solana CLI to be installed and will airdrop SOL to your accounts on devnet.

5. Build the program:
   ```
   npm run build
   ```

### Testing

Run the test suite:

```
anchor test
```

## Usage

### Deploying the Contract

1. Update the program ID in `Anchor.toml` and `lib.rs` with your own if needed
2. Set up your Solana wallet and ensure it has SOL for deployment
3. Run the deployment script:
   ```
   npm run deploy:mainnet
   ```

### For Users

To authorize tokens for payment:

```
yarn authorize <token_mint_address> <amount>
```

Example:
```
yarn authorize EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 10
```

This authorizes 10 USDC (assuming the provided address is USDC) for payments.

### For Admins

Admin operations:

1. Add an owner:
   ```
   yarn admin add-owner <owner_public_key>
   ```

2. Add a merchant:
   ```
   yarn admin add-merchant <merchant_public_key>
   ```

3. Process a payment:
   ```
   yarn admin process-payment <user_public_key> <merchant_public_key> <token_mint_address> <amount>
   ```

   Example:
   ```
   yarn admin process-payment 7KBVGvotfYJwfKJzAfEY5jabbus3MsZTGiALWi67L8Y2 Hm1rJ4DmXZMxXFMPuieeKGgMUJaZ6r7AzWhtKbg94pTY EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 3
   ```

   This processes a payment of 3 USDC from the user to the merchant.

## Security Considerations

- The contract ensures only authorized owners can add merchants and process payments
- Users maintain control of their tokens until a payment is processed
- Tokens remain in the user's wallet until a specific payment is authorized and processed
- Only whitelisted merchants can receive payments

## Environment Variables

Create a `.env` file with the following variables:

```
# For deployment
DEPLOYER_KEYPAIR_PATH=/path/to/deployer_keypair.json

# For user operations
USER_KEYPAIR_PATH=/path/to/user_keypair.json

# For admin operations
ADMIN_KEYPAIR_PATH=/path/to/admin_keypair.json
```

## Contract Workflow

1. **Initialization**: The deployer initializes the contract and becomes the authority
2. **Add Owners**: The authority adds owners to the contract
3. **Add Merchants**: Owners add merchants to the whitelist
4. **User Authorization**: Users authorize tokens for payments
5. **Payment Processing**: Owners trigger payments from users to merchants

## License

[ISC License](LICENSE)


