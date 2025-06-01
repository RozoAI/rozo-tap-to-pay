# Rozo Tap-to-Pay Program on Solana

The Solana program that powers the Rozo Tap-to-Pay system, a decentralized payment solution for Solana tokens.

**Deployed on Solana Devnet (in progress) **: [MVMxTF7pYwzi4rjKRMe8v2pKxiEcGa5TR7LbR59jiLe](https://solscan.io/account/MVMxTF7pYwzi4rjKRMe8v2pKxiEcGa5TR7LbR59jiLe?cluster=devnet)


## Use Case Flow

<img src="../public/Tap2PayUseCase.png" width="50%" alt="Tap-to-Pay Use Case Flow">


## Payment Flow and Cod 

### Step 1: Merchant Whitelisting - add_merchant by Rozo
Rozo (contract owner) adds a coffee shop to the merchant whitelist. Only whitelisted merchants can receive payments through the system.

### Step 2: User Authorization for DePins - authorize_payment by User
A user authorizes 10 USDC for his devices. It can be her/his Solana Mobile, Smart Wearables, AI Agents or a Robot Dog. This creates an authorization record, but the 10 USDC remains in the user's wallet until a payment is processed.

### Step 3: Payment Processing - process_payment by Rozo (PayMaster)
When the user buys a $2 coffee from the whitelisted coffee shop:
1. The Rozo payment processor triggers the smart contract
2. The contract verifies the coffee shop is whitelisted
3. The contract checks the user has sufficient authorization (10 USDC > $2)
4. $2 worth of USDC is transferred from the user's wallet to the coffee shop
5. The user's authorization balance is reduced from 10 USDC to 8 USDC

This happens instantly without requiring the user to sign a transaction for each purchase.



## Technical Architecture

<img src="../public/TapTechDePin.png" width="60%" alt="Technical DePIN Architecture">


## Key Components

### Accounts
- **Program Config**: Stores the contract authority
- **Owner Account**: Identifies who can add merchants 
- **Merchant Account**: Records whitelisted merchants
- **Payment Auth**: Tracks user payment authorizations
