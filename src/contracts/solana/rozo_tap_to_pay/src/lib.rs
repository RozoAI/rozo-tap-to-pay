use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};
use anchor_lang::solana_program::pubkey::Pubkey as SolanaPubkey;

// Program ID: replace with your deployed program id
// declare_id!("YourProgramId1111111111111111111111111111111111");

declare_id!("RozoTapToPay111111111111111111111111111111111111");

// Solana Name Service Program ID
pub mod name_service {
    use super::*;
    pub static ID: SolanaPubkey = solana_program::pubkey!("namesLPneVptA9Z5rqUDD9tMTWEJwofgaYwp8cawRkX");
    
    // Root domain
    pub static ROOT_DOMAIN: SolanaPubkey = solana_program::pubkey!("58PwtjSDuFHuUkYjH9BYnnQKHfwo9reZhC2zMJv9JPkx");
    
    // .sol TLD
    pub static SOL_TLD: SolanaPubkey = solana_program::pubkey!("2LcGFF9LXFZVUQxjQQkiuTCWdGd7dxnxn5RRVQTHm7Z6");
}

// Define time periods for leaderboards
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TimePeriod {
    Daily,
    Weekly,
    Monthly,
    AllTime,
}

#[program]
pub mod rozo_tap_to_pay {
    use super::*;

    // Program initialization - sets the admin (can only be called once)
    pub fn initialize_program(ctx: Context<InitializeProgram>) -> Result<()> {
        // Set the program admin to the one who initialized the program
        let program_state = &mut ctx.accounts.program_state;
        program_state.admin = ctx.accounts.admin.key();
        program_state.bump = *ctx.bumps.get("program_state").unwrap();
        
        msg!("Program initialized with admin: {}", program_state.admin);
        Ok(())
    }
    
    // Update the admin (can only be called by current admin)
    pub fn update_admin(ctx: Context<UpdateAdmin>, new_admin: Pubkey) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        
        // Current admin is already verified through the constraint in UpdateAdmin
        program_state.admin = new_admin;
        
        msg!("Admin updated to: {}", new_admin);
        Ok(())
    }

    // ✅ STEP 1: Wallet Authorization to Smart Contract (Setup Phase)
    // User authorizes a specific amount of USDC that can be spent via tap-to-pay
    pub fn initialize_authorization(
        ctx: Context<InitializeAuthorization>,
        amount: u64,
    ) -> Result<()> {
        // Initialize the escrow account data
        let escrow = &mut ctx.accounts.escrow;
        escrow.owner = ctx.accounts.user.key();
        escrow.usdc_vault = ctx.accounts.escrow_token_account.key();
        escrow.bump = *ctx.bumps.get("escrow").unwrap();
        escrow.allowed = amount;
        escrow.spent = 0;
        
        // Transfer the user's USDC to the escrow token account
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.escrow_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
        );
        
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Authorization initialized: {} USDC authorized", amount);
        Ok(())
    }

    // ✅ STEP 2: Tap-to-Pay Flow (Deduction Phase)
    // Only the admin can trigger payment from user's escrow
    pub fn tap_to_pay(
        ctx: Context<TapToPay>,
        amount: u64,
        session_id: [u8; 32],
    ) -> Result<()> {
        // Admin verification is enforced in the TapToPay struct constraints
        
        let escrow = &mut ctx.accounts.escrow;
        
        // Check if there's enough authorized funds
        require!(escrow.allowed - escrow.spent >= amount, ErrorCode::InsufficientFunds);

        // Transfer USDC from escrow to merchant
        let seeds = &[b"escrow", escrow.owner.as_ref(), &[escrow.bump]];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.merchant_token_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        
        token::transfer(cpi_ctx, amount)?;

        // Update spent amount
        escrow.spent += amount;
        
        msg!("Payment processed by admin: {} USDC transferred to merchant", amount);
        msg!("Session ID: {:?}", session_id);
        
        // Optionally update leaderboard if account is provided
        if !ctx.accounts.leaderboard.data_is_empty() && !ctx.accounts.user_stats.data_is_empty() {
            // Update user statistics
            let user_stats = &mut ctx.accounts.user_stats;
            user_stats.total_spent += amount;
            user_stats.transaction_count += 1;
            user_stats.last_transaction = Clock::get()?.unix_timestamp;
            
            msg!("User stats updated: {} total spent, {} transactions", 
                user_stats.total_spent, 
                user_stats.transaction_count
            );
            
            // Update global leaderboard stats if needed
            let leaderboard = &mut ctx.accounts.leaderboard;
            if leaderboard.entry_count < LEADERBOARD_MAX_ENTRIES || user_stats.total_spent > leaderboard.min_entry_amount {
                msg!("User qualifies for leaderboard update");
                // Actual leaderboard ranking would be done in a separate instruction
                // to avoid making tap_to_pay too computationally expensive
            }
        }
        
        Ok(())
    }

    // Revoke unspent authorization
    pub fn revoke_authorization(ctx: Context<RevokeAuthorization>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        
        // Check if there are remaining unspent funds
        let remaining = escrow.allowed - escrow.spent;
        require!(remaining > 0, ErrorCode::NoRemainingAllowance);
        
        // First, update the escrow data
        escrow.allowed = escrow.spent;
        
        // Transfer remaining USDC back to user
        let seeds = &[b"escrow", escrow.owner.as_ref(), &[escrow.bump]];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        };
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer,
        );
        
        token::transfer(cpi_ctx, remaining)?;
        
        msg!("Authorization revoked: {} USDC returned to user", remaining);
        Ok(())
    }

    // Close escrow account and return remaining funds
    pub fn close_escrow(ctx: Context<CloseEscrow>) -> Result<()> {
        // Transfer any remaining funds from escrow back to user
        let remaining_balance = ctx.accounts.escrow_token_account.amount;
        
        if remaining_balance > 0 {
            let seeds = &[b"escrow", ctx.accounts.user.key().as_ref(), &[ctx.accounts.escrow.bump]];
            let signer = &[&seeds[..]];
            
            let cpi_accounts = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.escrow.to_account_info(),
            };
            
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer,
            );
            
            token::transfer(cpi_ctx, remaining_balance)?;
            msg!("Remaining balance of {} USDC returned to user", remaining_balance);
        }
        
        msg!("Escrow account closed");
        Ok(())
    }
    
    // Get user's SNS name - this is a placeholder for tap to pay leaderboard
    pub fn get_user_name(ctx: Context<GetUserName>) -> Result<()> {
        // Read information from name service - here we only log, actual functionality is handled client-side
        if ctx.accounts.name_account.data_is_empty() {
            msg!("No SNS name found for this user");
        } else {
            // In an actual implementation, we would parse the name account data
            msg!("User has a registered SNS name");
        }
        
        Ok(())
    }
    
    // Initialize user statistics for leaderboard
    pub fn initialize_user_stats(ctx: Context<InitializeUserStats>) -> Result<()> {
        let user_stats = &mut ctx.accounts.user_stats;
        user_stats.user = ctx.accounts.user.key();
        user_stats.total_spent = 0;
        user_stats.transaction_count = 0;
        user_stats.last_transaction = Clock::get()?.unix_timestamp;
        user_stats.rank = 0; // Will be updated when leaderboard is processed
        user_stats.has_sns_name = false; // Will be updated if SNS name is found
        
        msg!("User stats initialized for leaderboard tracking");
        Ok(())
    }
    
    // Initialize a new leaderboard
    pub fn initialize_leaderboard(
        ctx: Context<InitializeLeaderboard>,
        time_period: TimePeriod,
        category: String
    ) -> Result<()> {
        require!(category.len() <= 32, ErrorCode::InvalidCategory);
        
        let leaderboard = &mut ctx.accounts.leaderboard;
        leaderboard.time_period = time_period;
        leaderboard.category = category;
        leaderboard.last_updated = Clock::get()?.unix_timestamp;
        leaderboard.entry_count = 0;
        leaderboard.min_entry_amount = 0;
        
        msg!("Leaderboard initialized: {:?} - {}", time_period, category);
        Ok(())
    }
    
    // Update leaderboard rankings - this would be triggered periodically
    pub fn update_leaderboard_rankings(ctx: Context<UpdateLeaderboardRankings>) -> Result<()> {
        let leaderboard = &mut ctx.accounts.leaderboard;
        
        // In a real implementation, this would sort all UserStats accounts and update ranks
        // This is simplified for illustration
        
        leaderboard.last_updated = Clock::get()?.unix_timestamp;
        msg!("Leaderboard rankings updated");
        
        // Emit an event with the top users
        emit!(LeaderboardUpdated {
            time_period: leaderboard.time_period.clone(),
            category: leaderboard.category.clone(),
            timestamp: leaderboard.last_updated,
        });
        
        Ok(())
    }
}

// Constants
const LEADERBOARD_MAX_ENTRIES: u16 = 100; // Maximum entries in a leaderboard

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

// ✅ STEP 1: Initialize Authorization Accounts
#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct InitializeAuthorization<'info> {
    #[account(
        init,
        payer = user,
        seeds = [b"escrow", user.key().as_ref()],
        bump,
        space = 8 + 32 + 32 + 1 + 8 + 8
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key(),
        constraint = user_token_account.mint == usdc_mint.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = user,
        associated_token::mint = usdc_mint,
        associated_token::authority = escrow
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    pub usdc_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
}

// ✅ STEP 2: Tap-to-Pay Accounts
#[derive(Accounts)]
pub struct TapToPay<'info> {
    // Verify that the signer is the admin
    #[account(
        seeds = [b"program-state"],
        bump = program_state.bump,
        constraint = program_state.admin == admin.key() @ ErrorCode::NotAuthorized
    )]
    pub program_state: Account<'info, ProgramState>,
    
    // The admin must sign the transaction
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(mut, seeds = [b"escrow", user.key().as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    
    /// CHECK: user is only used as a seed
    pub user: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub merchant: UncheckedAccount<'info>,
    
    #[account(
        mut,
        constraint = escrow_token_account.key() == escrow.usdc_vault
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = merchant_token_account.owner == merchant.key()
    )]
    pub merchant_token_account: Account<'info, TokenAccount>,
    
    // Optional leaderboard accounts
    /// CHECK: These accounts are optional and will be checked if provided
    #[account(mut)]
    pub leaderboard: UncheckedAccount<'info>,
    
    /// CHECK: User stats account is optional
    #[account(mut)]
    pub user_stats: UncheckedAccount<'info>,
    
    pub token_program: Program<'info, Token>,
}

// Revoke authorization accounts
#[derive(Accounts)]
pub struct RevokeAuthorization<'info> {
    #[account(mut, seeds = [b"escrow", user.key().as_ref()], bump = escrow.bump)]
    pub escrow: Account<'info, Escrow>,
    
    #[account(mut, constraint = user.key() == escrow.owner)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = escrow_token_account.key() == escrow.usdc_vault
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

// Close escrow accounts
#[derive(Accounts)]
pub struct CloseEscrow<'info> {
    #[account(
        mut,
        close = user,
        seeds = [b"escrow", user.key().as_ref()],
        bump = escrow.bump,
        constraint = user.key() == escrow.owner
    )]
    pub escrow: Account<'info, Escrow>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        constraint = escrow_token_account.key() == escrow.usdc_vault
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = user_token_account.owner == user.key()
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

// Name service account structure
#[derive(Accounts)]
pub struct GetUserName<'info> {
    pub user: Signer<'info>,
    /// CHECK: The name account is owned by the name service program, we only read it
    #[account(owner = name_service::ID)]
    pub name_account: UncheckedAccount<'info>,
}

// Initialize user statistics for leaderboard
#[derive(Accounts)]
pub struct InitializeUserStats<'info> {
    #[account(
        init,
        payer = user,
        seeds = [b"user-stats", user.key().as_ref()],
        bump,
        space = 8 + 32 + 8 + 4 + 8 + 2 + 1
    )]
    pub user_stats: Account<'info, UserStats>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// Initialize leaderboard
#[derive(Accounts)]
#[instruction(time_period: TimePeriod, category: String)]
pub struct InitializeLeaderboard<'info> {
    #[account(
        init,
        payer = admin,
        seeds = [
            b"leaderboard", 
            time_period_to_bytes(&time_period).as_ref(),
            category.as_bytes()
        ],
        bump,
        space = 8 + 4 + 32 + 8 + 2 + 8
    )]
    pub leaderboard: Account<'info, Leaderboard>,
    
    // Only admin can create leaderboards
    #[account(
        seeds = [b"program-state"],
        bump = program_state.bump,
        constraint = program_state.admin == admin.key() @ ErrorCode::NotAuthorized
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// Update leaderboard rankings
#[derive(Accounts)]
pub struct UpdateLeaderboardRankings<'info> {
    #[account(mut)]
    pub leaderboard: Account<'info, Leaderboard>,
    
    // Only admin can update leaderboards
    #[account(
        seeds = [b"program-state"],
        bump = program_state.bump,
        constraint = program_state.admin == admin.key() @ ErrorCode::NotAuthorized
    )]
    pub program_state: Account<'info, ProgramState>,
    
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

// Program state to store admin information
#[account]
pub struct ProgramState {
    pub admin: Pubkey,   // Admin (contract deployer) who can update settings and trigger tap-to-pay
    pub bump: u8,        // PDA bump seed
}

#[account]
pub struct Escrow {
    pub owner: Pubkey,       // User's wallet address
    pub usdc_vault: Pubkey,  // Token account holding the user's USDC
    pub bump: u8,            // PDA bump seed
    pub allowed: u64,        // Total authorized amount
    pub spent: u64,          // Amount already spent via tap-to-pay
}

// User statistics for leaderboard
#[account]
pub struct UserStats {
    pub user: Pubkey,           // User's wallet address
    pub total_spent: u64,       // Total amount spent via tap-to-pay
    pub transaction_count: u32, // Number of transactions
    pub last_transaction: i64,  // Timestamp of last transaction
    pub rank: u16,              // Current rank in leaderboard
    pub has_sns_name: bool,     // Whether user has an SNS name
}

// Leaderboard with rankings
#[account]
pub struct Leaderboard {
    pub time_period: TimePeriod,      // Daily, weekly, monthly, all-time
    pub category: String,             // Optional category (e.g., "coffee", "retail")
    pub last_updated: i64,            // Unix timestamp of last update
    pub entry_count: u16,             // Number of entries in the leaderboard
    pub min_entry_amount: u64,        // Minimum amount spent to qualify for leaderboard
}

// Event emitted when leaderboard is updated
#[event]
pub struct LeaderboardUpdated {
    pub time_period: TimePeriod,
    pub category: String,
    pub timestamp: i64,
}

// Helper function to convert TimePeriod to bytes for seeds
fn time_period_to_bytes(time_period: &TimePeriod) -> [u8; 1] {
    match time_period {
        TimePeriod::Daily => [0],
        TimePeriod::Weekly => [1],
        TimePeriod::Monthly => [2],
        TimePeriod::AllTime => [3],
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient funds in escrow.")]
    InsufficientFunds,
    
    #[msg("No remaining allowance to revoke.")]
    NoRemainingAllowance,
    
    #[msg("Not authorized to perform this action.")]
    NotAuthorized,
    
    #[msg("Invalid category name (maximum 32 characters).")]
    InvalidCategory,
} 