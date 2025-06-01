#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# =================================
# Configuration - Change these values as needed
# =================================

# Program ID
PROGRAM_ID="MVMxTF7pYwzi4rjKRMe8v2pKxiEcGa5TR7LbR59jiLe"

# USDC Dev token mint address on devnet
USDC_DEV_MINT="Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"

# Merchant public key
MERCHANT="AEEtekA2EBYVy3e5Xx8fD3GkjWSoCsLvLzdD6pZTgHiH"

# Authorization amount (USDC)
AUTH_AMOUNT=10

# Payment amount (USDC)
PAYMENT_AMOUNT=1

# Path to keypairs
DEPLOYER_KEYPAIR="./keys/deployer.json"
USER_KEYPAIR="./keys/user.json"
PROGRAM_KEYPAIR="./target/deploy/rozo_tap_to_pay-keypair.json"

# Minimum SOL balance required (in SOL)
MIN_SOL_BALANCE=0.1

# Solana network to use
NETWORK="devnet"

# =================================
# Main script - Don't change below unless you know what you're doing
# =================================

echo -e "${YELLOW}===== Rozo Tap-to-Pay Demo (${NETWORK}) =====${NC}"
echo 

# Get public keys
DEPLOYER_PUBKEY=$(solana-keygen pubkey $DEPLOYER_KEYPAIR)
USER_PUBKEY=$(solana-keygen pubkey $USER_KEYPAIR)

# Export variables so TypeScript can access them
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET=$DEPLOYER_KEYPAIR
export DEPLOYER_KEYPAIR_PATH=$DEPLOYER_KEYPAIR
export USER_KEYPAIR_PATH=$USER_KEYPAIR
export ADMIN_KEYPAIR_PATH=$DEPLOYER_KEYPAIR

# Check account balances first
echo -e "${YELLOW}Checking account balances...${NC}"

# Check deployer balance
DEPLOYER_BALANCE=$(solana balance $DEPLOYER_PUBKEY --url $NETWORK | awk '{print $1}')
echo "Deployer balance: $DEPLOYER_BALANCE SOL"

# Check if balance is below minimum
if (( $(echo "$DEPLOYER_BALANCE < $MIN_SOL_BALANCE" | bc -l 2>/dev/null) )) || [ -z "$DEPLOYER_BALANCE" ]; then
  echo -e "${RED}Error: Deployer account needs more SOL!${NC}"
  echo -e "Please fund the deployer account with devnet SOL using one of these methods:"
  echo -e "  ${GREEN}solana airdrop 1 $DEPLOYER_PUBKEY --url $NETWORK${NC}"
  echo -e "  Or use the Solana devnet faucet: https://solfaucet.com/"
  exit 1
fi

# Check user balance
USER_BALANCE=$(solana balance $USER_PUBKEY --url $NETWORK | awk '{print $1}')
echo "User balance: $USER_BALANCE SOL"

# Check if balance is below minimum
if (( $(echo "$USER_BALANCE < $MIN_SOL_BALANCE" | bc -l 2>/dev/null) )) || [ -z "$USER_BALANCE" ]; then
  echo -e "${YELLOW}Warning: User account is low on SOL!${NC}"
  echo -e "Consider funding the user account with devnet SOL using one of these methods:"
  echo -e "  ${GREEN}solana airdrop 1 $USER_PUBKEY --url $NETWORK${NC}"
  echo -e "  Or use the Solana devnet faucet: https://solfaucet.com/"
  echo
fi

# Skip building for now since you're having Rust version issues
echo -e "${YELLOW}Skipping build step due to Rust version compatibility issues...${NC}"
echo -e "Note: You should build manually with a compatible Rust version:"
echo -e "  ${GREEN}rustup default 1.68.0${NC}  # Or another version compatible with Solana"
echo -e "  ${GREEN}cd programs/rozo-tap-to-pay && cargo build-bpf${NC}"
echo

# 1. Check if program exists on devnet
echo -e "${YELLOW}1. Checking if program exists on devnet...${NC}"
if solana program show $PROGRAM_ID --url $NETWORK &> /dev/null; then
  echo -e "${GREEN}Program already deployed to devnet!${NC}"
else
  echo -e "${YELLOW}Program not found on devnet.${NC}"
  
  # Check if program binary exists
  PROGRAM_SO="target/deploy/rozo_tap_to_pay.so"
  if [ ! -f "$PROGRAM_SO" ]; then
    echo -e "${RED}Error: Program binary not found at $PROGRAM_SO${NC}"
    echo -e "You need to build the program first with a compatible Rust version."
    echo -e "Try: ${GREEN}rustup default 1.68.0 && cd programs/rozo-tap-to-pay && cargo build-bpf${NC}"
    exit 1
  fi
  
  echo -e "${YELLOW}Deploying program...${NC}"
  # Deploy using solana CLI
  solana program deploy $PROGRAM_SO \
    --program-id $PROGRAM_KEYPAIR \
    --keypair $DEPLOYER_KEYPAIR \
    --url $NETWORK
    
  if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to deploy program${NC}"
    exit 1
  fi
fi
echo

# 2. Initialize the program
echo -e "${YELLOW}2. Initializing program...${NC}"
npx ts-node scripts/deploy/deploy-testnet.ts "$PROGRAM_ID"
echo 

# Exit after initialization for testing
exit 0

# 3. Add merchant to whitelist
echo -e "${YELLOW}3. Adding merchant to whitelist: ${MERCHANT}${NC}"
npx ts-node scripts/merchant/add-merchant.ts "$MERCHANT" "$PROGRAM_ID"
echo 

# 4. User authorizes USDC Dev
echo -e "${YELLOW}4. User authorizing ${AUTH_AMOUNT} USDC Dev tokens...${NC}"
# Temporarily set user wallet for this operation
export ANCHOR_WALLET=$USER_KEYPAIR
npx ts-node scripts/authorize/authorize-usdc.ts "$AUTH_AMOUNT" "$USDC_DEV_MINT" "$PROGRAM_ID"
# Reset to deployer wallet
export ANCHOR_WALLET=$DEPLOYER_KEYPAIR
echo 

# 5. Process payment (USDC Dev from user to merchant)
echo -e "${YELLOW}5. Processing payment: ${PAYMENT_AMOUNT} USDC Dev from user to merchant...${NC}"
npx ts-node scripts/payment/process-payment.ts "$USER_PUBKEY" "$MERCHANT" "$PAYMENT_AMOUNT" "$USDC_DEV_MINT" "$PROGRAM_ID"
echo 

echo -e "${GREEN}===== Demo Complete =====${NC}" 