import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RozoSwaptopay } from "../target/types/rozo_swaptopay";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("rozo_swaptopay", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RozoSwaptopay as Program<RozoSwaptopay>;
  
  // Test wallets
  const admin = Keypair.generate();
  const user = Keypair.generate();
  const merchant = Keypair.generate();
  
  // PDAs and accounts
  let programStatePDA: PublicKey;
  let programStateBump: number;
  let treasuryPDA: PublicKey;
  let treasuryBump: number;
  
  // Token accounts
  let usdcMint: PublicKey;
  let programUsdcAccount: PublicKey;
  let userUsdcAccount: PublicKey;
  let merchantUsdcAccount: PublicKey;
  let adminUsdcAccount: PublicKey;
  
  // Constants for testing
  const USDC_DECIMALS = 6; // USDC has 6 decimals
  const INITIAL_USDC_SUPPLY = 10000 * 10**USDC_DECIMALS; // 10,000 USDC
  
  before(async () => {
    // Airdrop SOL to admin, user, and merchant
    await provider.connection.requestAirdrop(admin.publicKey, 100 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(user.publicKey, 10 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(merchant.publicKey, 5 * LAMPORTS_PER_SOL);
    
    // Find PDAs
    [programStatePDA, programStateBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("program-state")],
      program.programId
    );
    
    [treasuryPDA, treasuryBump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("treasury")],
      program.programId
    );
    
    // Create USDC mint (simulated)
    usdcMint = await createMint(
      provider.connection,
      admin,
      admin.publicKey,
      null,
      USDC_DECIMALS
    );
    
    // Create token accounts
    userUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      usdcMint,
      user.publicKey
    );
    
    merchantUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      usdcMint,
      merchant.publicKey
    );
    
    adminUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      usdcMint,
      admin.publicKey
    );
    
    // Mint some USDC to admin
    await mintTo(
      provider.connection,
      admin,
      usdcMint,
      adminUsdcAccount,
      admin.publicKey,
      INITIAL_USDC_SUPPLY
    );
  });

  it("Initialize program", async () => {
    // Initialize the program with admin
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
    
    // Verify program state
    const programState = await program.account.programState.fetch(programStatePDA);
    assert.equal(programState.admin.toString(), admin.publicKey.toString());
  });

  it("Create program USDC account", async () => {
    // Create token account for program
    programUsdcAccount = await createAssociatedTokenAccount(
      provider.connection,
      admin,
      usdcMint,
      programStatePDA,
      true // allowOwnerOffCurve = true to allow PDA to own a token account
    );
    
    // Deposit initial liquidity from admin
    const depositAmount = 1000 * 10**USDC_DECIMALS; // 1,000 USDC
    
    await program.methods
      .depositUsdc(new anchor.BN(depositAmount))
      .accounts({
        programState: programStatePDA,
        user: admin.publicKey,
        userUsdcAccount: adminUsdcAccount,
        programUsdcAccount: programUsdcAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([admin])
      .rpc();
  });

  it("User pays with SOL and recipient receives USDC", async () => {
    // Test parameters
    const solAmount = 1 * LAMPORTS_PER_SOL; // 1 SOL
    const usdcAmount = 25 * 10**USDC_DECIMALS; // 25 USDC (example exchange rate)
    const sessionId = Keypair.generate().publicKey.toBytes().slice(0, 32);
    
    // Find swap history PDA
    const [swapHistoryPDA] = await PublicKey.findProgramAddressSync(
      [Buffer.from("swap-history"), user.publicKey.toBuffer(), Buffer.from(sessionId)],
      program.programId
    );
    
    // Perform swap and payment
    await program.methods
      .solToUsdcPay(
        new anchor.BN(solAmount),
        new anchor.BN(usdcAmount),
        merchant.publicKey,
        sessionId
      )
      .accounts({
        programState: programStatePDA,
        treasury: treasuryPDA,
        user: user.publicKey,
        paymentRecipient: merchant.publicKey,
        programUsdcAccount: programUsdcAccount,
        recipientUsdcAccount: merchantUsdcAccount,
        swapHistory: swapHistoryPDA,
        usdcMint: usdcMint,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
    
    // Verify merchant received USDC
    const merchantUsdcBalance = await provider.connection.getTokenAccountBalance(merchantUsdcAccount);
    assert.equal(merchantUsdcBalance.value.uiAmount, 25);
    
    // Verify swap history was recorded
    const swapHistory = await program.account.swapHistory.fetch(swapHistoryPDA);
    assert.equal(swapHistory.user.toString(), user.publicKey.toString());
    assert.equal(swapHistory.recipient.toString(), merchant.publicKey.toString());
    assert.equal(swapHistory.solAmount.toString(), solAmount.toString());
    assert.equal(swapHistory.usdcAmount.toString(), usdcAmount.toString());
  });

  it("Admin can withdraw SOL from treasury", async () => {
    // Get admin's initial balance
    const initialAdminBalance = await provider.connection.getBalance(admin.publicKey);
    
    // Get treasury balance
    const treasuryBalance = await provider.connection.getBalance(treasuryPDA);
    
    // Withdraw all SOL from treasury
    await program.methods
      .withdrawSol(new anchor.BN(treasuryBalance))
      .accounts({
        programState: programStatePDA,
        treasury: treasuryPDA,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    
    // Verify admin received the SOL (minus tx fee)
    const finalAdminBalance = await provider.connection.getBalance(admin.publicKey);
    const expectedIncrease = treasuryBalance - 5000; // Approximation accounting for tx fee
    assert(finalAdminBalance > initialAdminBalance + expectedIncrease);
    
    // Verify treasury is empty
    const finalTreasuryBalance = await provider.connection.getBalance(treasuryPDA);
    assert.equal(finalTreasuryBalance, 0);
  });
}); 