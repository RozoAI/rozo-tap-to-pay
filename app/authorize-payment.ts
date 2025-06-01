import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

// Read command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: ts-node authorize-payment.ts <amount>");
  process.exit(1);
}

// USDC Dev mint address
const tokenMintAddress = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const amount = parseFloat(args[0]);

async function main() {
  // Configure the client to use the network from environment
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load the IDL from programs/rozo-tap-to-pay/src/lib.rs
  const idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../target/idl/rozo_tap_to_pay.json"), "utf-8")
  );

  // Get program ID
  const programId = new anchor.web3.PublicKey("MVMxTF7pYwzi4rjKRMe8v2pKxiEcGa5TR7LbR59jiLe");
  
  // Create program interface
  const program = new Program(idl, programId, provider);

  // Get user's keypair
  const keypairPath = process.env.USER_KEYPAIR_PATH || "./keys/user.json";
  if (!fs.existsSync(keypairPath)) {
    console.error(`User keypair file not found at ${keypairPath}`);
    console.error("Please create a keypair file and set the USER_KEYPAIR_PATH environment variable");
    process.exit(1);
  }

  const userKeypair = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );

  console.log("User public key:", userKeypair.publicKey.toString());

  // Parse token mint address
  const mintPubkey = new anchor.web3.PublicKey(tokenMintAddress);
  
  // Convert amount to token amount (with decimals)
  // This assumes the token has 6 decimals (like USDC)
  // In a production app, you should fetch the token's decimals from the blockchain
  const TOKEN_DECIMALS = 6;
  const tokenAmount = new anchor.BN(amount * Math.pow(10, TOKEN_DECIMALS));

  console.log(`Authorizing ${amount} tokens (${tokenAmount.toString()} base units)`);

  // Derive PDAs
  const [programConfigPDA] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("program_config")],
    program.programId
  );

  const [paymentAuthPDA] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("payment_auth"), userKeypair.publicKey.toBuffer(), mintPubkey.toBuffer()],
    program.programId
  );

  // Authorize the payment
  try {
    console.log("Authorizing payment...");
    const tx = await program.methods
      .authorizePayment(tokenAmount)
      .accounts({
        programConfig: programConfigPDA,
        paymentAuth: paymentAuthPDA,
        user: userKeypair.publicKey,
        tokenMint: mintPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([userKeypair])
      .rpc();

    console.log("Payment authorized successfully!");
    console.log("Transaction signature:", tx);
  } catch (error) {
    console.error("Error authorizing payment:", error);
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