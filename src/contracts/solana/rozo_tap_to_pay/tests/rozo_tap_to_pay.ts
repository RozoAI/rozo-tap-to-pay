import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { RozoTapToPay } from "../target/types/rozo_tap_to_pay";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccount,
  getAssociatedTokenAddress,
  createMint,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { assert } from "chai";

describe("rozo_tap_to_pay", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RozoTapToPay as Program<RozoTapToPay>;
  
  // Generate a new keypair for the USDC mint
  const usdcMint = anchor.web3.Keypair.generate();
  
  // Generate users and merchant
  const user = anchor.web3.Keypair.generate();
  const merchant = anchor.web3.Keypair.generate();
  const admin = provider.wallet; // Use the provider wallet as admin for testing
  
  // Program state account
  let programStatePDA: anchor.web3.PublicKey;
  let programStateBump: number;
  
  // Prepare accounts for our tests
  let userUSDC: anchor.web3.PublicKey;
  let merchantUSDC: anchor.web3.PublicKey;
  let escrowPDA: anchor.web3.PublicKey;
  let escrowTokenAccount: anchor.web3.PublicKey;
  let escrowBump: number;
  
  // Some constants for our tests
  const DECIMALS = 6; // USDC typically uses 6 decimals
  const INITIAL_USER_BALANCE = 1000_000_000; // 1000 USDC with 6 decimals
  const ALLOWED_AMOUNT = 100_000_000; // 100 USDC allowance
  const TAP_PAYMENT_AMOUNT = 10_000_000; // 10 USDC payment amount

  it("Initialize test environment", async () => {
    // Airdrop SOL to user and merchant
    const userAirdrop = await provider.connection.requestAirdrop(
      user.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(userAirdrop);
    
    const merchantAirdrop = await provider.connection.requestAirdrop(
      merchant.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(merchantAirdrop);
    
    // Create USDC mint
    await createMint(
      provider.connection,
      provider.wallet.payer,
      provider.wallet.publicKey,
      null,
      DECIMALS,
      usdcMint
    );
    
    // Create associated token accounts for user and merchant
    userUSDC = await createAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint.publicKey,
      user.publicKey
    );
    
    merchantUSDC = await createAssociatedTokenAccount(
      provider.connection,
      provider.wallet.payer,
      usdcMint.publicKey,
      merchant.publicKey
    );
    
    // Mint USDC to user
    await mintTo(
      provider.connection,
      provider.wallet.payer,
      usdcMint.publicKey,
      userUSDC,
      provider.wallet.payer,
      INITIAL_USER_BALANCE
    );
    
    // Find the PDA for our program state account
    [programStatePDA, programStateBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("program-state")],
      program.programId
    );
    
    // Find the PDA for our escrow account
    [escrowPDA, escrowBump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("escrow"), user.publicKey.toBuffer()],
      program.programId
    );
    
    // Find the associated token address for the escrow's USDC vault
    escrowTokenAccount = await getAssociatedTokenAddress(
      usdcMint.publicKey,
      escrowPDA,
      true
    );
    
    console.log("Test environment initialized");
  });
  
  it("Initialize program with admin", async () => {
    // Initialize the program with the admin
    await program.methods
      .initializeProgram()
      .accounts({
        programState: programStatePDA,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    // Fetch program state to verify admin
    const programState = await program.account.programState.fetch(programStatePDA);
    assert.equal(
      programState.admin.toString(),
      admin.publicKey.toString(),
      "Admin should be set to provider wallet"
    );
    
    console.log("Program initialized with admin:", admin.publicKey.toString());
  });

  it("✅ STEP 1: Initialize authorization with USDC allowance", async () => {
    // Check user's USDC balance before
    const userBalanceBefore = await provider.connection.getTokenAccountBalance(userUSDC);
    
    // Initialize the escrow with a 100 USDC allowance
    await program.methods
      .initializeAuthorization(new anchor.BN(ALLOWED_AMOUNT))
      .accounts({
        escrow: escrowPDA,
        user: user.publicKey,
        userTokenAccount: userUSDC,
        escrowTokenAccount: escrowTokenAccount,
        usdcMint: usdcMint.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
    
    // Fetch escrow account to check initialization
    const escrow = await program.account.escrow.fetch(escrowPDA);
    assert.equal(
      escrow.owner.toString(),
      user.publicKey.toString(),
      "Owner should be the user"
    );
    assert.equal(
      escrow.allowed.toString(),
      ALLOWED_AMOUNT.toString(),
      "Allowance should be set correctly"
    );
    assert.equal(
      escrow.spent.toString(),
      "0",
      "Spent amount should initialize to 0"
    );
    
    // Check that funds were transferred to escrow
    const escrowBalance = await provider.connection.getTokenAccountBalance(escrowTokenAccount);
    assert.equal(
      escrowBalance.value.amount,
      ALLOWED_AMOUNT.toString(),
      "Escrow should receive the authorized USDC amount"
    );
    
    // Check that user's balance was reduced
    const userBalanceAfter = await provider.connection.getTokenAccountBalance(userUSDC);
    const expectedUserBalance = (Number(userBalanceBefore.value.amount) - ALLOWED_AMOUNT).toString();
    assert.equal(
      userBalanceAfter.value.amount,
      expectedUserBalance,
      "User's USDC should be reduced by the authorized amount"
    );
    
    console.log("✅ STEP 1: Successfully authorized 100 USDC for tap-to-pay");
  });

  it("✅ STEP 2: Execute a tap-to-pay transaction (admin only)", async () => {
    // Generate a random session ID (like a tap transaction UUID)
    const sessionId = anchor.web3.Keypair.generate().publicKey.toBytes().slice(0, 32);
    
    // Check balances before payment
    const escrowBalanceBefore = await provider.connection.getTokenAccountBalance(escrowTokenAccount);
    const merchantBalanceBefore = await provider.connection.getTokenAccountBalance(merchantUSDC);
    
    // Perform a tap-to-pay transaction - Only admin can execute this
    await program.methods
      .tapToPay(new anchor.BN(TAP_PAYMENT_AMOUNT), sessionId)
      .accounts({
        programState: programStatePDA,
        admin: admin.publicKey,
        escrow: escrowPDA,
        user: user.publicKey,
        merchant: merchant.publicKey,
        escrowTokenAccount: escrowTokenAccount,
        merchantTokenAccount: merchantUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    // Fetch updated escrow and check balance changes
    const escrow = await program.account.escrow.fetch(escrowPDA);
    assert.equal(
      escrow.spent.toString(),
      TAP_PAYMENT_AMOUNT.toString(),
      "Spent amount should be updated"
    );
    
    // Check that escrow balance was reduced
    const escrowBalanceAfter = await provider.connection.getTokenAccountBalance(escrowTokenAccount);
    const expectedEscrowBalance = (Number(escrowBalanceBefore.value.amount) - TAP_PAYMENT_AMOUNT).toString();
    assert.equal(
      escrowBalanceAfter.value.amount,
      expectedEscrowBalance,
      "Escrow balance should be reduced by payment amount"
    );
    
    // Check that merchant received payment
    const merchantBalanceAfter = await provider.connection.getTokenAccountBalance(merchantUSDC);
    const expectedMerchantBalance = (Number(merchantBalanceBefore.value.amount) + TAP_PAYMENT_AMOUNT).toString();
    assert.equal(
      merchantBalanceAfter.value.amount,
      expectedMerchantBalance,
      "Merchant should receive payment"
    );
    
    console.log("✅ STEP 2: Admin successfully executed a 10 USDC tap-to-pay transaction");
  });

  it("Try to execute tap-to-pay as non-admin (should fail)", async () => {
    // Generate a random session ID (like a tap transaction UUID)
    const sessionId = anchor.web3.Keypair.generate().publicKey.toBytes().slice(0, 32);
    
    try {
      // Create a new keypair to attempt the transaction
      const nonAdmin = anchor.web3.Keypair.generate();
      
      // Airdrop SOL to non-admin for transaction fees
      const airdrop = await provider.connection.requestAirdrop(
        nonAdmin.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);
      
      // Attempt tap-to-pay as non-admin - This should fail
      await program.methods
        .tapToPay(new anchor.BN(TAP_PAYMENT_AMOUNT), sessionId)
        .accounts({
          programState: programStatePDA,
          admin: nonAdmin.publicKey, // Using non-admin account
          escrow: escrowPDA,
          user: user.publicKey,
          merchant: merchant.publicKey,
          escrowTokenAccount: escrowTokenAccount,
          merchantTokenAccount: merchantUSDC,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([nonAdmin])
        .rpc();
      
      assert.fail("Transaction should have failed since signer is not admin");
    } catch (error) {
      // We expect an error since the signer is not the admin
      assert.include(
        error.toString(), 
        "NotAuthorized", 
        "Transaction should fail with NotAuthorized error"
      );
      console.log("✓ Correctly rejected tap-to-pay from non-admin");
    }
  });

  it("Update admin", async () => {
    // Create a new admin
    const newAdmin = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to new admin for transaction fees
    const airdrop = await provider.connection.requestAirdrop(
      newAdmin.publicKey,
      1 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdrop);
    
    // Update admin (can only be done by current admin)
    await program.methods
      .updateAdmin(newAdmin.publicKey)
      .accounts({
        programState: programStatePDA,
        admin: admin.publicKey,
      })
      .rpc();
    
    // Fetch program state to verify new admin
    const programState = await program.account.programState.fetch(programStatePDA);
    assert.equal(
      programState.admin.toString(),
      newAdmin.publicKey.toString(),
      "Admin should be updated to new admin"
    );
    
    console.log("Admin updated to:", newAdmin.publicKey.toString());
  });

  it("Revoke authorization and return remaining funds", async () => {
    // Get escrow state before revocation
    const escrowBefore = await program.account.escrow.fetch(escrowPDA);
    const remainingAllowance = escrowBefore.allowed.sub(escrowBefore.spent);
    
    // Get balances before revocation
    const userBalanceBefore = await provider.connection.getTokenAccountBalance(userUSDC);
    const escrowBalanceBefore = await provider.connection.getTokenAccountBalance(escrowTokenAccount);
    
    // Revoke authorization
    await program.methods
      .revokeAuthorization()
      .accounts({
        escrow: escrowPDA,
        user: user.publicKey,
        escrowTokenAccount: escrowTokenAccount,
        userTokenAccount: userUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
    
    // Fetch updated escrow
    const escrowAfter = await program.account.escrow.fetch(escrowPDA);
    assert.equal(
      escrowAfter.allowed.toString(),
      escrowAfter.spent.toString(),
      "Allowance should be reduced to match spent amount"
    );
    
    // Check that remaining funds were returned to user
    const userBalanceAfter = await provider.connection.getTokenAccountBalance(userUSDC);
    const expectedUserBalance = (Number(userBalanceBefore.value.amount) + Number(remainingAllowance.toString())).toString();
    assert.equal(
      userBalanceAfter.value.amount,
      expectedUserBalance,
      "User should receive remaining allowance"
    );
    
    // Check that escrow balance was reduced
    const escrowBalanceAfter = await provider.connection.getTokenAccountBalance(escrowTokenAccount);
    const expectedEscrowBalance = (Number(escrowBalanceBefore.value.amount) - Number(remainingAllowance.toString())).toString();
    assert.equal(
      escrowBalanceAfter.value.amount,
      expectedEscrowBalance,
      "Escrow balance should be reduced by returned amount"
    );
    
    console.log("Authorization successfully revoked with funds returned to user");
  });

  it("Close escrow and return any remaining funds", async () => {
    // Get user USDC balance before closing
    const userBalanceBefore = await provider.connection.getTokenAccountBalance(userUSDC);
    const escrowBalanceBefore = await provider.connection.getTokenAccountBalance(escrowTokenAccount);
    
    // Close the escrow
    await program.methods
      .closeEscrow()
      .accounts({
        escrow: escrowPDA,
        user: user.publicKey,
        escrowTokenAccount: escrowTokenAccount,
        userTokenAccount: userUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();
    
    // Check that any remaining funds were returned to user
    const userBalanceAfter = await provider.connection.getTokenAccountBalance(userUSDC);
    const expectedUserBalance = (Number(userBalanceBefore.value.amount) + Number(escrowBalanceBefore.value.amount)).toString();
    assert.equal(
      userBalanceAfter.value.amount,
      expectedUserBalance,
      "User should receive any remaining balance"
    );
    
    // Verify escrow account was closed
    try {
      await program.account.escrow.fetch(escrowPDA);
      assert.fail("Escrow account should be closed");
    } catch (error) {
      // Expected error
      assert.include(
        error.toString(),
        "Account does not exist",
        "Escrow account should be closed"
      );
    }
    
    console.log("Escrow successfully closed with any remaining funds returned");
  });
}); 