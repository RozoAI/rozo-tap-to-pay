# Rozo SwapToPay Solana Contract

This repository contains the Solana smart contract for the Rozo SwapToPay system, designed to enable SOL to USDC conversion for cryptocurrency payments.

## Features

- Automatic SOL to USDC conversion for payments
- Admin management for treasury funds
- Transaction history tracking with session IDs
- Fixed or dynamic exchange rates (configurable)
- Withdrawal functions for managing treasury

## Contract Overview

The SwapToPay contract enables users to pay with SOL, which is automatically converted to USDC for the recipient. This simplifies the payment flow by allowing the payer to use SOL while the merchant or recipient receives USDC.

### Main Components

1. **Program State**: Stores admin information and global settings
2. **Treasury**: Holds SOL received from users
3. **USDC Vault**: Program-controlled USDC account for conversions
4. **Swap History**: Records all transaction details

### Key Instructions

- `initialize_program`: Set up the program with an admin
- `sol_to_usdc_pay`: Convert SOL to USDC and pay recipient
- `deposit_usdc`: Add USDC liquidity to the program
- `withdraw_sol`: Admin can withdraw SOL from treasury
- `withdraw_usdc`: Admin can withdraw USDC from the program

## Development Environment Setup

### Prerequisites

- Solana CLI tools
- Anchor framework
- Node.js and NPM/Yarn
- Rust and Cargo

### Installation

```bash
# Clone repository
git clone https://github.com/RozoAI/rozo-swaptopay.git
cd rozo-swaptopay/src/contracts/solana/rozo_swaptopay

# Install dependencies
npm install

# Build program
anchor build
```

### Local Testing

```bash
# Run tests
anchor test
```

## Deployment

### Devnet Deployment

```bash
# Deploy to devnet
anchor deploy --provider.cluster devnet
```

### Mainnet Deployment

```bash
# Deploy to mainnet
anchor deploy --provider.cluster mainnet-beta
```

## Usage Examples

### Initialize Program

```typescript
await program.methods
  .initializeProgram()
  .accounts({
    programState: programStatePDA,
    treasury: treasuryPDA,
    admin: admin.publicKey,
    systemProgram: anchor.web3.SystemProgram.programId,
  })
  .signers([admin])
  .rpc();
```

### Make SOL Payment (Convert to USDC)

```typescript
await program.methods
  .solToUsdcPay(
    new anchor.BN(solAmount),
    new anchor.BN(usdcAmount),
    recipientAddress,
    sessionId
  )
  .accounts({
    programState: programStatePDA,
    treasury: treasuryPDA,
    user: wallet.publicKey,
    paymentRecipient: recipientAddress,
    programUsdcAccount: programUsdcAccount,
    recipientUsdcAccount: recipientUsdcAccount,
    swapHistory: swapHistoryPDA,
    usdcMint: usdcMintAddress,
    systemProgram: anchor.web3.SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

## Running the Example Script

The repository includes an example script to demonstrate SOL to USDC conversion:

```bash
# Install ts-node if not already installed
npm install -g ts-node

# Run the example with 1 SOL to the specified recipient
ts-node examples/sol-to-usdc.ts 1 <recipient-wallet-address>
```

## Security Considerations

- Only the admin can withdraw funds from the treasury
- Session IDs prevent double-spending
- Transaction history is recorded on-chain for auditability
- Program uses PDAs to securely manage funds

## License

MIT 