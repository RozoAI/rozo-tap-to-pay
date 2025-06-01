import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

// Read command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error(
    "Usage: ts-node admin.ts <command> [args...]\n" +
    "Commands:\n" +
    "  add-merchant\n" +
    "  process-payment <amount>"
  );
  process.exit(1);
}

const command = args[0];

// Constants
const USDC_DEV_MINT = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const MERCHANT_ADDRESS = "AEEtekA2EBYVy3e5Xx8fD3GkjWSoCsLvLzdD6pZTgHiH";

async function main() {
  // Configure the client to use the network from environment
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load the IDL from target/idl
  const idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../target/idl/rozo_tap_to_pay.json"), "utf-8")
  );

  // Get program ID
  const programId = new anchor.web3.PublicKey("MVMxTF7pYwzi4rjKRMe8v2pKxiEcGa5TR7LbR59jiLe");
  
  // Create program interface
  const program = new Program(idl, programId, provider);

  // Get admin's keypair
  const keypairPath = process.env.ADMIN_KEYPAIR_PATH || "./keys/deployer.json";
  if (!fs.existsSync(keypairPath)) {
    console.error(`Admin keypair file not found at ${keypairPath}`);
    console.error("Please create a keypair file and set the ADMIN_KEYPAIR_PATH environment variable");
    process.exit(1);
  }

  const adminKeypair = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );

  console.log("Admin public key:", adminKeypair.publicKey.toString());

  // Derive program config PDA
  const [programConfigPDA] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("program_config")],
    program.programId
  );

  switch (command) {
    case "add-merchant": {
      const merchantPubkey = new anchor.web3.PublicKey(MERCHANT_ADDRESS);

      // Derive PDAs
      const [ownerPDA] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("owner"), adminKeypair.publicKey.toBuffer()],
        program.programId
      );

      const [merchantPDA] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("merchant"), merchantPubkey.toBuffer()],
        program.programId
      );

      try {
        console.log(`Adding merchant: ${merchantPubkey.toString()}`);
        const tx = await program.methods
          .addMerchant(merchantPubkey)
          .accounts({
            programConfig: programConfigPDA,
            ownerAccount: ownerPDA,
            merchantAccount: merchantPDA,
            authority: adminKeypair.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([adminKeypair])
          .rpc();

        console.log("Merchant added successfully!");
        console.log("Transaction signature:", tx);
      } catch (error) {
        console.error("Error adding merchant:", error);
        process.exit(1);
      }
      break;
    }

    case "process-payment": {
      if (args.length < 2) {
        console.error("Usage: ts-node admin.ts process-payment <amount>");
        process.exit(1);
      }

      // Get user keypair
      const userKeypairPath = process.env.USER_KEYPAIR_PATH || "./keys/user.json";
      if (!fs.existsSync(userKeypairPath)) {
        console.error(`User keypair file not found at ${userKeypairPath}`);
      const userPubkey = new anchor.web3.PublicKey(args[1]);
      const merchantPubkey = new anchor.web3.PublicKey(args[2]);
      const mintPubkey = new anchor.web3.PublicKey(args[3]);
      const amount = parseFloat(args[4]);

      // Convert amount to token amount (with decimals)
      // This assumes the token has 6 decimals (like USDC)
      const TOKEN_DECIMALS = 6;
      const tokenAmount = new anchor.BN(amount * Math.pow(10, TOKEN_DECIMALS));

      // Derive PDAs
      const [ownerPDA] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("owner"), adminKeypair.publicKey.toBuffer()],
        program.programId
      );

      const [merchantPDA] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("merchant"), merchantPubkey.toBuffer()],
        program.programId
      );

      const [paymentAuthPDA] = await anchor.web3.PublicKey.findProgramAddress(
        [Buffer.from("payment_auth"), userPubkey.toBuffer(), mintPubkey.toBuffer()],
        program.programId
      );

      // Get associated token accounts
      const userTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        userPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const merchantTokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        merchantPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      try {
        console.log(`Processing payment of ${amount} tokens from ${userPubkey.toString()} to ${merchantPubkey.toString()}`);
        
        // Note: In a real application, you would need to get the user's signature
        // This example assumes the admin has the ability to sign on behalf of the user
        // which is not secure or realistic. In a real app, you would need to collect
        // the user's signature separately.
        
        // This will fail without the user's signature
        console.log("Warning: This will fail without the user's signature");
        console.log("In a real application, you would need to collect the user's signature");
        
        const tx = await program.methods
          .processPayment(tokenAmount)
          .accounts({
            programConfig: programConfigPDA,
            ownerAccount: ownerPDA,
            merchantAccount: merchantPDA,
            paymentAuth: paymentAuthPDA,
            user: userPubkey,
            userTokenAccount: userTokenAccount,
            merchantTokenAccount: merchantTokenAccount,
            tokenMint: mintPubkey,
            authority: adminKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([adminKeypair])
          .rpc();

        console.log("Payment processed successfully!");
        console.log("Transaction signature:", tx);
      } catch (error) {
        console.error("Error processing payment:", error);
        process.exit(1);
      }
      break;
    }

    default:
      console.error(
        "Unknown command. Available commands: add-owner, add-merchant, process-payment"
      );
      process.exit(1);
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  }
); 