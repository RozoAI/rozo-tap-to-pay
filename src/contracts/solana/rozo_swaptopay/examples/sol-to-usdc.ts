import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RozoSwaptopay } from "../target/types/rozo_swaptopay";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, Connection, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Usage example:
// ts-node examples/sol-to-usdc.ts <sol-amount> <recipient-address>

async function main() {
  try {
    // Get command line arguments
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
      console.log("Usage: ts-node examples/sol-to-usdc.ts <sol-amount> <recipient-address>");
      return;
    }
    
    const solAmount = parseFloat(args[0]) * LAMPORTS_PER_SOL; // Convert to lamports
    const recipientAddress = new PublicKey(args[1]);
    
    // Connect to Solana network (default to devnet for this example)
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    
    // Load wallet from local keypair file
    const walletKeyPath = path.resolve(
      process.env.HOME,
      ".config",
      "solana",
      "id.json"
    );
    const walletKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(fs.readFileSync(walletKeyPath, "utf-8")))
    );
    
    const wallet = new anchor.Wallet(walletKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    
    // Set up the program ID and load the IDL
    const programId = new PublicKey("RozoSwapToPay111111111111111111111111111111111");
    const idl = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, "../target/idl/rozo_swaptopay.json"), "utf8")
    );
    
    // Create the program interface
    const program = new anchor.Program(idl, programId, provider) as Program<RozoSwaptopay>;
    
    // Find PDAs
    const [programStatePDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from("program-state")],
      program.programId
    );
    
    const [treasuryPDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );
    
    // USDC mint address (using Solana devnet USDC address for this example)
    const usdcMintAddress = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    
    // Calculate USDC amount based on exchange rate
    // For this example, we use a simple 1 SOL = 25 USDC rate
    const exchangeRate = 25;
    const usdcAmount = Math.floor((solAmount / LAMPORTS_PER_SOL) * exchangeRate * 1000000); // USDC has 6 decimals
    
    // Get USDC token accounts
    const programUsdcAccount = await getAssociatedTokenAddress(
      usdcMintAddress, 
      programStatePDA, 
      true // allowOwnerOffCurve = true
    );
    
    const recipientUsdcAccount = await getAssociatedTokenAddress(
      usdcMintAddress, 
      recipientAddress
    );
    
    // Generate a unique session ID
    const sessionId = Keypair.generate().publicKey.toBytes().slice(0, 32);
    
    // Find swap history PDA
    const [swapHistoryPDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from("swap-history"), wallet.publicKey.toBuffer(), Buffer.from(sessionId)],
      program.programId
    );
    
    console.log(`Swapping ${solAmount / LAMPORTS_PER_SOL} SOL for ${usdcAmount / 1000000} USDC to recipient ${recipientAddress.toString()}`);
    
    // Execute the transaction
    const tx = await program.methods
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
    
    console.log(`Transaction successful! 🎉`);
    console.log(`Transaction signature: ${tx}`);
    console.log(`Explorer link: https://explorer.solana.com/tx/${tx}?cluster=devnet`);
    
  } catch (error) {
    console.error("Error executing SOL to USDC swap:");
    console.error(error);
  }
}

main(); 