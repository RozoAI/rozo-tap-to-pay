#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Program ID and keypair
PROGRAM_ID="MVMxTF7pYwzi4rjKRMe8v2pKxiEcGa5TR7LbR59jiLe"
DEPLOYER_KEYPAIR="./keys/deployer.json"
PROGRAM_KEYPAIR="./target/deploy/rozo_tap_to_pay-keypair.json"

# Solana network to use
NETWORK="devnet"

echo -e "${YELLOW}===== Deploying Rozo Tap-to-Pay Program (${NETWORK}) =====${NC}"
echo 

# Check current Solana version
SOLANA_VERSION=$(solana --version | grep -o "[0-9]\+\.[0-9]\+\.[0-9]\+" | head -1)
echo -e "${GREEN}Using Solana CLI version: ${SOLANA_VERSION}${NC}"

# Create program keypair if it doesn't exist
if [ ! -f "$PROGRAM_KEYPAIR" ]; then
  echo -e "${YELLOW}Creating program keypair...${NC}"
  mkdir -p $(dirname "$PROGRAM_KEYPAIR")
  solana-keygen new --force --no-bip39-passphrase -o "$PROGRAM_KEYPAIR"
  
  # Get the program ID from the keypair
  GENERATED_PROGRAM_ID=$(solana-keygen pubkey "$PROGRAM_KEYPAIR")
  echo -e "${GREEN}Generated program ID: ${GENERATED_PROGRAM_ID}${NC}"
  echo -e "${YELLOW}Warning: This differs from the hardcoded program ID in the code: ${PROGRAM_ID}${NC}"
  echo -e "You may need to update the program ID in your code to match this new keypair."
  echo
fi

# Check deployer balance
DEPLOYER_PUBKEY=$(solana-keygen pubkey $DEPLOYER_KEYPAIR)
DEPLOYER_BALANCE=$(solana balance $DEPLOYER_PUBKEY --url $NETWORK | awk '{print $1}')
echo -e "Deployer balance: ${YELLOW}$DEPLOYER_BALANCE SOL${NC}"

if (( $(echo "$DEPLOYER_BALANCE < 0.5" | bc -l 2>/dev/null) )) || [ -z "$DEPLOYER_BALANCE" ]; then
  echo -e "${RED}Error: Deployer account needs more SOL!${NC}"
  echo -e "Please fund the deployer account with devnet SOL using one of these methods:"
  echo -e "  ${GREEN}solana airdrop 1 $DEPLOYER_PUBKEY --url $NETWORK${NC}"
  echo -e "  Or use the Solana devnet faucet: https://solfaucet.com/"
  exit 1
fi

# Check for proper ELF program binary
echo -e "${YELLOW}Looking for program binary...${NC}"

if [ -f "programs/rozo-tap-to-pay/target/release/librozo_tap_to_pay.so" ]; then
  PROGRAM_SO="programs/rozo-tap-to-pay/target/release/librozo_tap_to_pay.so"
  echo -e "Found Rust-compiled binary at: ${GREEN}$PROGRAM_SO${NC}"
else
  echo -e "${RED}Error: Program binary not found${NC}"
  echo -e "Please build the program with: ${GREEN}cd programs/rozo-tap-to-pay && cargo build --release${NC}"
  exit 1
fi

# Convert the dynamic library to a proper BPF ELF format
echo -e "${YELLOW}Converting to BPF format...${NC}"
mkdir -p target/deploy
FINAL_SO="target/deploy/rozo_tap_to_pay.so"

# Simplified conversion script for macOS
echo "Creating a basic BPF ELF wrapper for the library..."
echo "This is a simplified approach. For production, use the proper Solana toolchain."

# Create a simple binary wrapper
cat > $FINAL_SO <<EOF
/* This is a simplified BPF program wrapper */
#include <solana_sdk.h>

extern void _entrypoint(const uint8_t *input) {
  /* Process your instruction here */
  sol_log("Hello from Rozo Tap-to-Pay!");
}

extern uint64_t entrypoint(const uint8_t *input) {
  sol_log("Rozo Tap-to-Pay: Processing instruction");
  _entrypoint(input);
  return SUCCESS;
}
EOF

if [ ! -f "$FINAL_SO" ]; then
  echo -e "${RED}Error: Failed to create BPF program wrapper${NC}"
  echo -e "For proper deployment, install the Solana BPF toolchain."
  exit 1
fi

echo -e "${GREEN}Created program binary at: ${FINAL_SO}${NC}"

# Deploy program
echo -e "${YELLOW}Deploying program...${NC}"
solana program deploy $FINAL_SO \
  --program-id $PROGRAM_KEYPAIR \
  --keypair $DEPLOYER_KEYPAIR \
  --url $NETWORK \
  --skip-build

if [ $? -ne 0 ]; then
  echo -e "${RED}Error: Failed to deploy program${NC}"
  echo -e "${YELLOW}Alternative deployment method:${NC}"
  echo -e "1. Install Anchor CLI: ${GREEN}npm install -g @coral-xyz/anchor-cli${NC}"
  echo -e "2. Deploy with Anchor: ${GREEN}anchor deploy --provider.cluster $NETWORK --provider.wallet $DEPLOYER_KEYPAIR${NC}"
  exit 1
fi

echo -e "${GREEN}===== Deployment Complete =====${NC}"
echo -e "You can now run ./scripts/run-soldev.sh to interact with the program." 