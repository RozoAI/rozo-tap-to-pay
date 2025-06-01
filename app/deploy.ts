import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

async function main() {
  // Configure the client to use the network from environment
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load the IDL from programs/rozo-tap-to-pay/src/lib.rs
  const idl = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../target/idl/rozo_tap_to_pay.json"), "utf-8")
  );

  // Get program ID from Anchor.toml
  const programId = new anchor.web3.PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
  
  // Create program interface
  const program = new Program(idl, programId, provider);

  // Check if deployer has a keypair
  const keypairPath = process.env.DEPLOYER_KEYPAIR_PATH || "/path/to/keypair.json";
  if (!fs.existsSync(keypairPath)) {
    console.error(`Keypair file not found at ${keypairPath}`);
    console.error("Please create a keypair file and set the DEPLOYER_KEYPAIR_PATH environment variable");
    process.exit(1);
  }

  // Get deployer's keypair
  const deployerKeypair = anchor.web3.Keypair.fromSecretKey(
    Buffer.from(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );

  console.log("Deployer public key:", deployerKeypair.publicKey.toString());

  // Derive PDA for program config
  const [programConfigPDA] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("program_config")],
    program.programId
  );

  console.log("Program ID:", program.programId.toString());
  console.log("Program Config PDA:", programConfigPDA.toString());

  // Initialize the program with the deployer as the authority
  try {
    console.log("Initializing program...");
    const tx = await program.methods
      .initialize()
      .accounts({
        programConfig: programConfigPDA,
        authority: deployerKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([deployerKeypair])
      .rpc();

    console.log("Program initialized successfully!");
    console.log("Transaction signature:", tx);
  } catch (error) {
    console.error("Error initializing program:", error);
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