use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use anchor_spl::associated_token::AssociatedToken;
use solana_program::system_instruction;

declare_id!("RozoSwapToPay111111111111111111111111111111111");

#[program]
pub mod rozo_swaptopay {
    use super::*;

    // Initialize the program with an admin
    pub fn initialize_program(ctx: Context<InitializeProgram>) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        program_state.admin = ctx.accounts.admin.key();
        program_state.bump = *ctx.bumps.get("program_state").unwrap();
        
        msg!("Program initialized with admin: {}", program_state.admin);
        Ok(())
    }
    
    // Update the admin (can only be called by current admin)
    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        program_state.admin = new_admin;
        
        msg!("Admin updated to: {}", new_admin);
        Ok(())
    }

    // SOL to USDC Swap and Pay
    pub fn sol_to_usdc_pay(
        ctx: Context<SolToUsdcPay>, 
        sol_amount: u64,
        usdc_amount: u64,
        recipient: Pubkey,
        session_id: [u8; 32]
    ) -> Result<()> {
        // First, transfer SOL from user to swap treasury
        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.treasury.key(),
            sol_amount
        );
        
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.treasury.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        msg!("SOL transferred to treasury: {} lamports", sol_amount);
        
        // Now transfer USDC from program's USDC vault to the recipient
        let seeds = &[b"program-state", &[ctx.accounts.program_state.bump]];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.program_usdc_account.to_account_info(),
            to: ctx.accounts.recipient_usdc_account.to_account_info(),
            authority: ctx.accounts.program_state.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        
        token::transfer(cpi_ctx, usdc_amount)?;
        
        // Record the transaction in swap history
        let swap_history = &mut ctx.accounts.swap_history;
        swap_history.user = ctx.accounts.user.key();
        swap_history.recipient = recipient;
        swap_history.sol_amount = sol_amount;
        swap_history.usdc_amount = usdc_amount;
        swap_history.timestamp = Clock::get()?.unix_timestamp;
        swap_history.session_id = session_id;
        
        msg!("USDC payment completed: {} tokens to {}", usdc_amount, recipient);
        msg!("Session ID: {:?}", session_id);
        
        Ok(())
    }
    
    // Withdraw SOL from treasury (admin only)
    pub fn withdraw_sol(ctx: Context<WithdrawFunds>, amount: u64) -> Result<()> {
        // Only admin can withdraw funds
        require!(
            ctx.accounts.program_state.admin == ctx.accounts.admin.key(),
            ErrorCode::NotAuthorized
        );
        
        // Transfer SOL from treasury to admin
        let seeds = &[b"treasury", &[ctx.accounts.treasury.bump]];
        let signer = &[&seeds[..]];
        
        **ctx.accounts.treasury.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.admin.to_account_info().try_borrow_mut_lamports()? += amount;
        
        msg!("Withdrew {} SOL from treasury", amount);
        Ok(())
    }
    
    // Withdraw USDC from program (admin only)
    pub fn withdraw_usdc(ctx: Context<WithdrawUsdc>, amount: u64) -> Result<()> {
        // Only admin can withdraw funds
        require!(
            ctx.accounts.program_state.admin == ctx.accounts.admin.key(),
            ErrorCode::NotAuthorized
        );
        
        // Transfer USDC from program to admin
        let seeds = &[b"program-state", &[ctx.accounts.program_state.bump]];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.program_usdc_account.to_account_info(),
            to: ctx.accounts.admin_usdc_account.to_account_info(),
            authority: ctx.accounts.program_state.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Withdrew {} USDC tokens from program", amount);
        Ok(())
    }
    
    // Deposit USDC to program (anyone can top up the liquidity)
    pub fn deposit_usdc(ctx: Context<DepositUsdc>, amount: u64) -> Result<()> {
        // Transfer USDC from user to program
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_usdc_account.to_account_info(),
            to: ctx.accounts.program_usdc_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Deposited {} USDC tokens to program", amount);
        Ok(())
    }
}

// Program state account to store admin information
#[derive(Accounts)]
pub struct InitializeProgram<'info> {
    #[account(
        init,
        payer = admin,
        seeds = [b"program-state"],
        bump,
        space = 8 + 32 + 1
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(
        init,
        payer = admin,
        seeds = [b"treasury"],
        bump,
        space = 8 + 1
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// Update admin account structure
#[derive(Accounts)]
pub struct UpdateAdmin<'info> {
    #[account(
        mut,
        seeds = [b"program-state"],
        bump = program_state.bump,
        constraint = program_state.admin == admin.key() @ ErrorCode::NotAuthorized
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
}

// SOL to USDC Payment
#[derive(Accounts)]
#[instruction(sol_amount: u64, usdc_amount: u64, recipient: Pubkey, session_id: [u8; 32])]
pub struct SolToUsdcPay<'info> {
    #[account(
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: This is the recipient, we're just storing their pubkey
    pub payment_recipient: UncheckedAccount<'info>,
    
    #[account(
        mut,
        constraint = program_usdc_account.owner == program_state.key()
    )]
    pub program_usdc_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub recipient_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = user,
        seeds = [b"swap-history", user.key().as_ref(), &session_id],
        bump,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 32
    )]
    pub swap_history: Account<'info, SwapHistory>,
    
    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

// Withdraw SOL from treasury
#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    #[account(
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(
        mut,
        seeds = [b"treasury"],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// Withdraw USDC from program
#[derive(Accounts)]
pub struct WithdrawUsdc<'info> {
    #[account(
        mut,
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        mut,
        constraint = program_usdc_account.owner == program_state.key()
    )]
    pub program_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = admin_usdc_account.owner == admin.key()
    )]
    pub admin_usdc_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

// Deposit USDC to program
#[derive(Accounts)]
pub struct DepositUsdc<'info> {
    #[account(
        seeds = [b"program-state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = user_usdc_account.owner == user.key()
    )]
    pub user_usdc_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = program_usdc_account.owner == program_state.key()
    )]
    pub program_usdc_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

// Program state to store admin information
#[account]
pub struct ProgramState {
    pub admin: Pubkey,   // Admin who can update settings and withdraw funds
    pub bump: u8,        // PDA bump seed
}

// Treasury account to store SOL
#[account]
pub struct Treasury {
    pub bump: u8,        // PDA bump seed
}

// Swap history to record transactions
#[account]
pub struct SwapHistory {
    pub user: Pubkey,           // User who performed the swap
    pub recipient: Pubkey,      // Recipient of the USDC payment
    pub sol_amount: u64,        // Amount of SOL swapped
    pub usdc_amount: u64,       // Amount of USDC paid
    pub timestamp: i64,         // Timestamp of the transaction
    pub session_id: [u8; 32],   // Unique session ID to prevent double-spending
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient funds in treasury.")]
    InsufficientFunds,
    
    #[msg("Not authorized to perform this action.")]
    NotAuthorized,
    
    #[msg("Invalid swap parameters.")]
    InvalidSwapParameters,
} 