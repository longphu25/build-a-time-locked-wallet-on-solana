#![allow(clippy::result_large_err)]
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

declare_id!("AMEdHNwAUw2eBkm26Pwn2aePe6bQ7Vgzjeavx3uNvkGn");

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

        msg!("Time lock initialized with {} lamports, unlocks at {}", amount, unlock_timestamp);
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, _amount: u64) -> Result<()> {
        // Check if unlock time has passed
        let current_timestamp = Clock::get()?.unix_timestamp;
        require!(
            current_timestamp >= ctx.accounts.time_lock.unlock_timestamp,
            TimeLockError::StillLocked
        );

        // Get the amount and total lamports before closing
        let amount = ctx.accounts.time_lock.amount;
        let time_lock_lamports = ctx.accounts.time_lock.to_account_info().lamports();

        // Transfer the locked amount back to user
        **ctx.accounts.time_lock.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;

        msg!("Successfully withdrawn {} lamports. PDA will be closed and {} total lamports returned (including rent)", amount, time_lock_lamports);
        
        // The PDA will be automatically closed due to the `close = user` constraint
        // and the remaining rent lamports will be returned to the user
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct InitializeLock<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + TimeLock::INIT_SPACE,
        seeds = [b"time_lock", user.key().as_ref(), &amount.to_le_bytes()],
        bump
    )]
    pub time_lock: Account<'info, TimeLock>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"time_lock", user.key().as_ref(), &amount.to_le_bytes()],
        has_one = user @TimeLockError::Unauthorized,
        close = user,
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
}

#[error_code]
pub enum TimeLockError {
    #[msg("Unlock timestamp must be in the future")]
    UnlockTimeInPast,
    #[msg("Funds are still locked")]
    StillLocked,
    #[msg("You are not authorized to withdraw from this time lock")]
    Unauthorized,
}
