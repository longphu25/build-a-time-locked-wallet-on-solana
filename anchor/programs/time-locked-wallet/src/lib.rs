#![allow(clippy::result_large_err, unexpected_cfgs)]

use anchor_lang::prelude::*;

declare_id!("G9C4ivjLy46CfRH8wbxBLDX4eSunQaZopoiSK2E9LymC");

#[program]
pub mod time_locked_wallet {
    use super::*;

    pub fn initialize_lock(
        ctx: Context<InitializeLock>,
        amount: u64,
        unlock_timestamp: i64,
    ) -> Result<()> {
        // Validate unlock timestamp is in the future
        let current_timestamp = Clock::get()?.unix_timestamp;
        require!(
            unlock_timestamp > current_timestamp,
            TimeLockError::UnlockTimeInPast
        );

        // Transfer SOL from user to the time lock PDA
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.time_lock.to_account_info(),
        };
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        );
        anchor_lang::system_program::transfer(cpi_context, amount)?;

        // Initialize the time lock account
        let time_lock = &mut ctx.accounts.time_lock;
        time_lock.user = ctx.accounts.user.key();
        time_lock.amount = amount;
        time_lock.unlock_timestamp = unlock_timestamp;
        time_lock.is_withdrawn = false;

        msg!("Time lock initialized with {} lamports, unlocks at {}", amount, unlock_timestamp);
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        // Check if funds have already been withdrawn
        require!(!ctx.accounts.time_lock.is_withdrawn, TimeLockError::AlreadyWithdrawn);

        // Check if unlock time has passed
        let current_timestamp = Clock::get()?.unix_timestamp;
        require!(
            current_timestamp >= ctx.accounts.time_lock.unlock_timestamp,
            TimeLockError::StillLocked
        );

        // Verify the user is the owner
        require!(
            ctx.accounts.time_lock.user == ctx.accounts.user.key(),
            TimeLockError::Unauthorized
        );

        // Get the amount to transfer
        let amount = ctx.accounts.time_lock.amount;

        // Transfer SOL back to user using lamport manipulation
        **ctx.accounts.time_lock.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;

        // Mark as withdrawn
        ctx.accounts.time_lock.is_withdrawn = true;

        msg!("Successfully withdrawn {} lamports", amount);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeLock<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + TimeLock::INIT_SPACE,
        seeds = [b"time_lock", user.key().as_ref()],
        bump
    )]
    pub time_lock: Account<'info, TimeLock>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"time_lock", user.key().as_ref()],
        bump
    )]
    pub time_lock: Account<'info, TimeLock>,
}

#[account]
#[derive(InitSpace)]
pub struct TimeLock {
    pub user: Pubkey,
    pub amount: u64,
    pub unlock_timestamp: i64,
    pub is_withdrawn: bool,
}

#[error_code]
pub enum TimeLockError {
    #[msg("Unlock timestamp must be in the future")]
    UnlockTimeInPast,
    #[msg("Funds are still locked")]
    StillLocked,
    #[msg("Funds have already been withdrawn")]
    AlreadyWithdrawn,
    #[msg("You are not authorized to withdraw from this time lock")]
    Unauthorized,
}
