use anchor_lang::prelude::*;

declare_id!("YourProgramIDHere...");

#[program]
pub mod prediction_market {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        question: String,
        end_time: i64,
        escrow_bump: u8,
        fee_bps: u16, // Fee in basis points (0-10000, where 10000 = 100%)
        grace_period_minutes: u8, // Grace period after end_time before resolution (0-60)
    ) -> Result<()> {
        // Validate inputs
        require!(question.len() <= 256, ErrorCode::QuestionTooLong);
        require!(question.len() > 0, ErrorCode::QuestionEmpty);
        require!(end_time > Clock::get()?.unix_timestamp, ErrorCode::InvalidEndTime);
        require!(fee_bps <= 1000, ErrorCode::FeeTooHigh); // Max 10% fee
        require!(grace_period_minutes <= 60, ErrorCode::GracePeriodTooLong); // Max 1 hour grace

        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.question = question.clone();
        market.end_time = end_time;
        market.resolution_deadline = end_time + (grace_period_minutes as i64 * 60); // Add grace period
        market.resolved = false;
        market.outcome = None;
        market.escrow = ctx.accounts.escrow.key();
        market.escrow_bump = escrow_bump;
        market.total_yes = 0;
        market.total_no = 0;
        market.fee_bps = fee_bps;
        market.cancelled = false;
        market.grace_period_minutes = grace_period_minutes;

        emit!(MarketCreated {
            market: market.key(),
            creator: market.creator,
            question,
            end_time,
            resolution_deadline: market.resolution_deadline,
            fee_bps,
            grace_period_minutes,
        });
        Ok(())
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        side: bool,
        amount: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;
        let clock = Clock::get()?;
        
        // Validate market state
        require!(!market.resolved, ErrorCode::MarketAlreadyResolved);
        require!(!market.cancelled, ErrorCode::MarketCancelled);
        require!(clock.unix_timestamp < market.end_time, ErrorCode::MarketClosed);
        require!(amount > 0, ErrorCode::InvalidBetAmount);

        // Prevent duplicate bets (one bet per user per market)
        require!(!bet.initialized, ErrorCode::DuplicateBet);

        // Transfer lamports from user to escrow PDA using CPI
        let user = ctx.accounts.user.to_account_info();
        let escrow = ctx.accounts.escrow.to_account_info();
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &user.key(),
            &escrow.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[user.clone(), escrow.clone()],
        )?;

        // Record bet (state mutation before any external calls)
        bet.user = user.key();
        bet.market = market.key();
        bet.side = side;
        bet.amount = amount;
        bet.claimed = false;
        bet.initialized = true;
        
        // Update market totals with checked math
        if side {
            market.total_yes = market.total_yes.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        } else {
            market.total_no = market.total_no.checked_add(amount).ok_or(ErrorCode::Overflow)?;
        }

        emit!(BetPlaced {
            market: market.key(),
            user: user.key(),
            side,
            amount,
            timestamp: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        outcome: bool,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;
        
        require!(!market.resolved, ErrorCode::MarketAlreadyResolved);
        require!(!market.cancelled, ErrorCode::MarketCancelled);
        require!(clock.unix_timestamp >= market.resolution_deadline, ErrorCode::MarketStillInGracePeriod);
        
        // Allow creator or authorized arbitrator to resolve
        require!(
            ctx.accounts.arbitrator.key() == market.creator || 
            ctx.accounts.arbitrator.key() == market.authorized_resolver.unwrap_or(Pubkey::default()),
            ErrorCode::UnauthorizedResolver
        );

        market.resolved = true;
        market.outcome = Some(outcome);
        
        emit!(MarketResolved {
            market: market.key(),
            outcome,
            resolver: ctx.accounts.arbitrator.key(),
            resolved_at: clock.unix_timestamp,
        });
        Ok(())
    }

    pub fn claim_winnings(
        ctx: Context<ClaimWinnings>,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;
        let user = &mut ctx.accounts.user;
        let escrow = &mut ctx.accounts.escrow;
        
        require!(market.resolved, ErrorCode::MarketStillOpen);
        require!(!bet.claimed, ErrorCode::AlreadyClaimed);
        require!(bet.user == user.key(), ErrorCode::NotYourBet);
        require!(bet.market == market.key(), ErrorCode::InvalidMarket);
        
        let outcome = market.outcome.ok_or(ErrorCode::MarketStillOpen)?;
        
        // Set claimed flag BEFORE any external calls (reentrancy protection)
        bet.claimed = true;
        
        // If bet was wrong, just mark as claimed with 0 payout
        if bet.side != outcome {
            emit!(Claimed {
                market: market.key(),
                user: user.key(),
                amount: 0,
                timestamp: Clock::get()?.unix_timestamp,
            });
            return Ok(());
        }

        // Calculate payout with fee deduction
        let total_winning = if outcome { market.total_yes } else { market.total_no };
        let total_pool = market.total_yes.checked_add(market.total_no).ok_or(ErrorCode::Overflow)?;
        require!(total_winning > 0, ErrorCode::NoWinners);
        
        // Calculate gross payout
        let gross_payout = (bet.amount as u128)
            .checked_mul(total_pool as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(total_winning as u128)
            .ok_or(ErrorCode::Overflow)? as u64;
        
        // Apply 1% total fee (0.5% to creator, 0.5% to treasury)
        let total_fee_bps = 100; // 1% = 100 basis points
        let creator_fee_bps = 50; // 0.5% = 50 basis points
        let treasury_fee_bps = 50; // 0.5% = 50 basis points
        
        let total_fee_amount = (gross_payout as u128)
            .checked_mul(total_fee_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)? as u64;
            
        let creator_fee_amount = (gross_payout as u128)
            .checked_mul(creator_fee_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)? as u64;
            
        let treasury_fee_amount = (gross_payout as u128)
            .checked_mul(treasury_fee_bps as u128)
            .ok_or(ErrorCode::Overflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::Overflow)? as u64;
        
        let net_payout = gross_payout.checked_sub(total_fee_amount).ok_or(ErrorCode::Overflow)?;
        
        // Verify escrow has sufficient balance
        require!(escrow.lamports() >= net_payout, ErrorCode::InsufficientEscrowBalance);
        
        // Transfer payout using CPI with signer seeds
        let escrow_seeds = &[
            b"escrow",
            market.key().as_ref(),
            &[market.escrow_bump]
        ];
        let signer_seeds = &[&escrow_seeds[..]];
        
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &escrow.key(),
            &user.key(),
            net_payout,
        );
        
        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[escrow.to_account_info(), user.to_account_info()],
            signer_seeds,
        )?;

        // Distribute fees if any
        if total_fee_amount > 0 {
            // Transfer creator fee to market creator
            if creator_fee_amount > 0 {
                let creator_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &escrow.key(),
                    &market.creator,
                    creator_fee_amount,
                );
                anchor_lang::solana_program::program::invoke_signed(
                    &creator_ix,
                    &[escrow.to_account_info()],
                    signer_seeds,
                )?;
            }
            
            // Transfer treasury fee
            if treasury_fee_amount > 0 {
                let treasury_ix = anchor_lang::solana_program::system_instruction::transfer(
                    &escrow.key(),
                    &ctx.accounts.treasury.key(),
                    treasury_fee_amount,
                );
                anchor_lang::solana_program::program::invoke_signed(
                    &treasury_ix,
                    &[escrow.to_account_info(), ctx.accounts.treasury.to_account_info()],
                    signer_seeds,
                )?;
            }
        }

        emit!(Claimed {
            market: market.key(),
            user: user.key(),
            amount: net_payout,
            creator_fee: creator_fee_amount,
            treasury_fee: treasury_fee_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn refund_bet(
        ctx: Context<RefundBet>,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        let bet = &mut ctx.accounts.bet;
        let user = &mut ctx.accounts.user;
        let escrow = &mut ctx.accounts.escrow;
        
        // Only allow refunds for cancelled markets
        require!(market.cancelled, ErrorCode::MarketNotCancelled);
        require!(!bet.claimed, ErrorCode::AlreadyClaimed);
        require!(bet.user == user.key(), ErrorCode::NotYourBet);
        require!(bet.market == market.key(), ErrorCode::InvalidMarket);
        
        // Set claimed flag BEFORE any external calls (reentrancy protection)
        bet.claimed = true;
        
        // Verify escrow has sufficient balance
        require!(escrow.lamports() >= bet.amount, ErrorCode::InsufficientEscrowBalance);
        
        // Transfer refund using CPI with signer seeds
        let escrow_seeds = &[
            b"escrow",
            market.key().as_ref(),
            &[market.escrow_bump]
        ];
        let signer_seeds = &[&escrow_seeds[..]];
        
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &escrow.key(),
            &user.key(),
            bet.amount,
        );
        
        anchor_lang::solana_program::program::invoke_signed(
            &ix,
            &[escrow.to_account_info(), user.to_account_info()],
            signer_seeds,
        )?;

        emit!(BetRefunded {
            market: market.key(),
            user: user.key(),
            amount: bet.amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn cancel_market(
        ctx: Context<CancelMarket>,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let clock = Clock::get()?;
        
        require!(!market.resolved, ErrorCode::MarketAlreadyResolved);
        require!(!market.cancelled, ErrorCode::MarketAlreadyCancelled);
        require!(clock.unix_timestamp < market.end_time, ErrorCode::MarketClosed);
        require!(ctx.accounts.creator.key() == market.creator, ErrorCode::UnauthorizedCancellation);
        
        // Only allow cancellation if no bets have been placed
        require!(
            market.total_yes == 0 && market.total_no == 0,
            ErrorCode::CannotCancelWithBets
        );
        
        market.cancelled = true;
        
        emit!(MarketCancelled {
            market: market.key(),
            cancelled_by: ctx.accounts.creator.key(),
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn close_escrow(
        ctx: Context<CloseEscrow>,
    ) -> Result<()> {
        let market = &ctx.accounts.market;
        let escrow = &mut ctx.accounts.escrow;
        let creator = &mut ctx.accounts.creator;
        
        require!(market.resolved, ErrorCode::MarketStillOpen);
        require!(escrow.lamports() == 0, ErrorCode::EscrowNotEmpty);
        require!(ctx.accounts.closer.key() == market.creator, ErrorCode::UnauthorizedClosure);
        
        // Use Anchor's close_account helper for safe account closure
        let rent = Rent::get()?;
        let rent_amount = rent.minimum_balance(0); // Escrow is rent-exempt
        
        // Close the escrow account and transfer rent to creator
        anchor_lang::system_program::close_account(CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::CloseAccount {
                account: escrow.to_account_info(),
                destination: creator.to_account_info(),
            },
        ))?;
        
        emit!(EscrowClosed {
            market: market.key(),
            closed_by: ctx.accounts.closer.key(),
            rent_reclaimed: rent_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }

    pub fn set_authorized_resolver(
        ctx: Context<SetAuthorizedResolver>,
        new_resolver: Option<Pubkey>,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(ctx.accounts.creator.key() == market.creator, ErrorCode::UnauthorizedResolver);
        require!(!market.resolved, ErrorCode::MarketAlreadyResolved);
        
        let old_resolver = market.authorized_resolver;
        market.authorized_resolver = new_resolver;
        
        emit!(AuthorizedResolverSet {
            market: market.key(),
            old_resolver,
            new_resolver,
            set_by: ctx.accounts.creator.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

// -----------------
// Account Structs
// -----------------

#[account]
#[derive(Default)]
pub struct Market {
    pub creator: Pubkey,                    // 32 bytes
    pub question: String,                   // 4 + 256 bytes (max 256 chars)
    pub end_time: i64,                      // 8 bytes
    pub resolution_deadline: i64,           // 8 bytes (end_time + grace_period)
    pub resolved: bool,                     // 1 byte
    pub outcome: Option<bool>,              // 2 bytes (1 for Some/None + 1 for bool)
    pub escrow: Pubkey,                     // 32 bytes (PDA)
    pub escrow_bump: u8,                    // 1 byte
    pub total_yes: u64,                     // 8 bytes
    pub total_no: u64,                      // 8 bytes
    pub fee_bps: u16,                       // 2 bytes (0-10000 basis points)
    pub cancelled: bool,                    // 1 byte
    pub authorized_resolver: Option<Pubkey>, // 33 bytes (1 for Some/None + 32 for Pubkey)
    pub grace_period_minutes: u8,           // 1 byte (0-60 minutes)
    // Total: ~400 bytes (allows for future expansion)
}

#[account]
#[derive(Default)]
pub struct Bet {
    pub user: Pubkey,       // 32 bytes
    pub market: Pubkey,     // 32 bytes
    pub side: bool,         // 1 byte
    pub amount: u64,        // 8 bytes
    pub claimed: bool,      // 1 byte
    pub initialized: bool,  // 1 byte (prevents duplicate bets)
    // Total: 75 bytes
}

// -----------------
// Contexts
// -----------------

#[derive(Accounts)]
pub struct CreateMarket<'info> {
    #[account(
        init, 
        payer = creator, 
        space = 8 + 32 + 4 + 256 + 8 + 8 + 1 + 2 + 32 + 1 + 8 + 8 + 2 + 1 + 33 + 1
    )]
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump
    )]
    pub escrow: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 32 + 1 + 8 + 1 + 1,
        seeds = [b"bet", market.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump = market.escrow_bump
    )]
    pub escrow: SystemAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// CHECK: Arbitrator (creator or authorized resolver)
    pub arbitrator: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"bet", market.key().as_ref(), user.key().as_ref()], bump)]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump = market.escrow_bump
    )]
    pub escrow: SystemAccount<'info>,
    /// CHECK: Treasury account for fee collection
    #[account(mut)]
    pub treasury: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct RefundBet<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, seeds = [b"bet", market.key().as_ref(), user.key().as_ref()], bump)]
    pub bet: Account<'info, Bet>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump = market.escrow_bump
    )]
    pub escrow: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct CancelMarket<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseEscrow<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"escrow", market.key().as_ref()],
        bump = market.escrow_bump
    )]
    pub escrow: SystemAccount<'info>,
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: Closer (must be creator)
    pub closer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAuthorizedResolver<'info> {
    #[account(mut)]
    pub market: Account<'info, Market>,
    pub creator: Signer<'info>,
}

// -----------------
// Events (Enhanced for Frontend Support)
// -----------------

#[event]
pub struct MarketCreated {
    pub market: Pubkey,           // Indexed for easy filtering
    pub creator: Pubkey,          // Indexed for user markets
    pub question: String,         // Non-indexed (too long)
    pub end_time: i64,            // Indexed for time-based queries
    pub resolution_deadline: i64, // Indexed for resolution queries
    pub fee_bps: u16,             // Non-indexed
    pub grace_period_minutes: u8, // Non-indexed
}

#[event]
pub struct BetPlaced {
    pub market: Pubkey,    // Indexed for market bets
    pub user: Pubkey,      // Indexed for user bets
    pub side: bool,        // Non-indexed
    pub amount: u64,       // Non-indexed
    pub timestamp: i64,    // Indexed for time-based queries
}

#[event]
pub struct MarketResolved {
    pub market: Pubkey,     // Indexed for market queries
    pub outcome: bool,      // Non-indexed
    pub resolver: Pubkey,   // Indexed for resolver queries
    pub resolved_at: i64,   // Indexed for time-based queries
}

#[event]
pub struct Claimed {
    pub market: Pubkey,    // Indexed for market claims
    pub user: Pubkey,      // Indexed for user claims
    pub amount: u64,       // Non-indexed (net payout after fees)
    pub creator_fee: u64,  // Non-indexed
    pub treasury_fee: u64, // Non-indexed
    pub timestamp: i64,    // Indexed for time-based queries
}

#[event]
pub struct BetRefunded {
    pub market: Pubkey,    // Indexed for market refunds
    pub user: Pubkey,      // Indexed for user refunds
    pub amount: u64,       // Non-indexed
    pub timestamp: i64,    // Indexed for time-based queries
}

#[event]
pub struct MarketCancelled {
    pub market: Pubkey,        // Indexed for market queries
    pub cancelled_by: Pubkey,  // Indexed for creator queries
    pub timestamp: i64,        // Indexed for time-based queries
}

#[event]
pub struct EscrowClosed {
    pub market: Pubkey,        // Indexed for market queries
    pub closed_by: Pubkey,     // Indexed for closer queries
    pub rent_reclaimed: u64,   // Non-indexed
    pub timestamp: i64,        // Indexed for time-based queries
}

#[event]
pub struct AuthorizedResolverSet {
    pub market: Pubkey,           // Indexed for market queries
    pub old_resolver: Option<Pubkey>, // Non-indexed
    pub new_resolver: Option<Pubkey>, // Non-indexed
    pub set_by: Pubkey,          // Indexed for setter queries
    pub timestamp: i64,          // Indexed for time-based queries
}

// -----------------
// Error Codes
// -----------------

#[error_code]
pub enum ErrorCode {
    #[msg("Market is already resolved.")]
    MarketAlreadyResolved,
    #[msg("Market is closed.")]
    MarketClosed,
    #[msg("Invalid bet amount.")]
    InvalidBetAmount,
    #[msg("Market is still open.")]
    MarketStillOpen,
    #[msg("Market is still in grace period.")]
    MarketStillInGracePeriod,
    #[msg("Unauthorized resolver.")]
    UnauthorizedResolver,
    #[msg("Already claimed.")]
    AlreadyClaimed,
    #[msg("Not your bet.")]
    NotYourBet,
    #[msg("Invalid market.")]
    InvalidMarket,
    #[msg("Overflow or underflow in math operation.")]
    Overflow,
    #[msg("No winners on this side.")]
    NoWinners,
    #[msg("Insufficient escrow balance for payout.")]
    InsufficientEscrowBalance,
    #[msg("Duplicate bet for this user and market.")]
    DuplicateBet,
    #[msg("Question is too long (max 256 characters).")]
    QuestionTooLong,
    #[msg("Question cannot be empty.")]
    QuestionEmpty,
    #[msg("Invalid end time (must be in the future).")]
    InvalidEndTime,
    #[msg("Fee is too high (max 10%).")]
    FeeTooHigh,
    #[msg("Grace period is too long (max 60 minutes).")]
    GracePeriodTooLong,
    #[msg("Market is cancelled.")]
    MarketCancelled,
    #[msg("Market is already cancelled.")]
    MarketAlreadyCancelled,
    #[msg("Cannot cancel market with existing bets.")]
    CannotCancelWithBets,
    #[msg("Unauthorized cancellation.")]
    UnauthorizedCancellation,
    #[msg("Escrow is not empty.")]
    EscrowNotEmpty,
    #[msg("Unauthorized closure.")]
    UnauthorizedClosure,
    #[msg("Market is not cancelled.")]
    MarketNotCancelled,
}

// TODO:
// - Add SPL token support for payouts
// - Add DAO-based dispute resolution
// - Add early market close with consensus
// - Add market templates/categories
// - Add user reputation system
// - Add automated resolution via oracles
// - Add market liquidity pools
// - Add social features (comments, likes)
// - Add market sharing and discovery
// - Add mobile app integration
// - Add multiple bets per user per market (v2)
// - Add market timeouts and auto-resolution
// - Add market categories and tags
// - Add user profiles and statistics 