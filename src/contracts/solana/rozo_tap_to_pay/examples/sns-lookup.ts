import * as anchor from "@project-serum/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import { NAME_PROGRAM_ID } from "@solana/spl-name-service";

/**
 * Solana Name Service constants
 */
const SOL_TLD_AUTHORITY = new PublicKey("58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx");
const SOL_TLD = new PublicKey("2LcGFF9LXFZVUQxjQQkiuTCWdGd7dxnxn5RRVQTHm7Z6");

/**
 * Name service account data structure
 */
interface NameRecordHeader {
  parentName: PublicKey;
  owner: PublicKey;
  class: PublicKey;
  data: Buffer;
}

/**
 * Parse record header from SNS account data
 */
function deserializeNameRecordHeader(data: Buffer): NameRecordHeader {
  return {
    parentName: new PublicKey(data.slice(0, 32)),
    owner: new PublicKey(data.slice(32, 64)),
    class: new PublicKey(data.slice(64, 96)),
    data: data.slice(96),
  };
}

/**
 * Reverse lookup SNS name by Solana address
 */
async function findSNSNameByOwner(
  connection: Connection,
  ownerAddress: PublicKey
): Promise<string | null> {
  // Get all name accounts owned by the user
  const accounts = await connection.getProgramAccounts(NAME_PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 32, // offset for owner field
          bytes: ownerAddress.toBase58(),
        },
      },
    ],
  });

  // Filter for .sol domains
  for (const account of accounts) {
    const nameRecord = deserializeNameRecordHeader(account.account.data);
    
    // Check if parent domain is .sol TLD
    if (nameRecord.parentName.equals(SOL_TLD)) {
      // Domain name content is stored in data field
      const domainName = Buffer.from(nameRecord.data).toString("utf8").replace(/\0/g, "");
      return `${domainName}.sol`;
    }
  }

  return null;
}

/**
 * Example flow for getting user name during payment
 */
async function processPaymentWithSNSLookup(userAddress: string): Promise<void> {
  // Create connection
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  
  try {
    // Convert user address to PublicKey
    const userPublicKey = new PublicKey(userAddress);
    
    // Query user's SNS name
    const snsName = await findSNSNameByOwner(connection, userPublicKey);
    
    console.log("Payment Processing");
    console.log("-------------------");
    console.log(`User Address: ${userAddress}`);
    
    if (snsName) {
      console.log(`User SNS Name: ${snsName}`);
      console.log(`Payment Confirmation: Charged 10 USDC to ${snsName}`);
    } else {
      console.log("User does not have an associated SNS name");
      console.log(`Payment Confirmation: Charged 10 USDC to anonymous user ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
    }
    
  } catch (error) {
    console.error("Error querying SNS name:", error);
    console.log(`Payment Confirmation: Charged 10 USDC to user ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`);
  }
}

/**
 * Main function
 */
async function main() {
  // Example user address - using a known user address as an example
  // Note: This is an example address, replace with actual address when using
  const userAddress = "2eAj31ZmRmzdYVgnRqYE9jSbGqMxMwBUB4sE3itTuqSx";
  
  await processPaymentWithSNSLookup(userAddress);
  
  // Output usage instructions
  console.log("\nUsage Instructions");
  console.log("-------------------");
  console.log("Call this function during payment processing to get the user's SNS name");
  console.log("1. Import this module");
  console.log("2. After payment completion, call processPaymentWithSNSLookup(userWalletAddress)");
  console.log("3. Display user name in receipts or transaction records");
}

// If this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Execution error:", error);
  });
}

// Export main functions for use in other modules
export { findSNSNameByOwner, processPaymentWithSNSLookup }; 