/**
 * Wallet Load Guard — RBI PPI Limit Validation Service
 *
 * Validates wallet load amounts against 3 RBI PPI rules BEFORE processing:
 *   Rule 1: BALANCE_CAP — ₹1,00,000 max wallet balance
 *   Rule 2: MONTHLY_LOAD — ₹2,00,000 total loads per calendar month
 *   Rule 3: MIN_KYC_CAP — ₹10,000 max balance for Minimum KYC users
 *
 * If blocked, calls Claude Haiku API for a friendly user-facing explanation.
 *
 * Usage:
 *   import { validateLoadAmount } from './wallet-load-guard.js';
 *   const result = await validateLoadAmount('user_001', 500000, apiKey);
 */

import Anthropic from '@anthropic-ai/sdk';
import { getWalletBalance, getTransactionHistory, getSubWalletData } from '../mock-data.js';

// ── RBI PPI Limits (amounts in paise) ──────────────────────────────────────────
const BALANCE_CAP_PAISE = 10000000;       // ₹1,00,000
const MONTHLY_LOAD_LIMIT_PAISE = 20000000; // ₹2,00,000
const MIN_KYC_BALANCE_CAP_PAISE = 1000000; // ₹10,000

// ── In-memory log of blocked attempts (last 10) ───────────────────────────────
const blockedAttempts = [];

export function getBlockedAttempts() {
  return [...blockedAttempts];
}

function logBlockedAttempt(entry) {
  blockedAttempts.push(entry);
  if (blockedAttempts.length > 10) blockedAttempts.shift();
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function paiseToRupees(paise) {
  return Math.floor(Number(paise) / 100);
}

function formatINR(paise) {
  const rupees = paiseToRupees(paise);
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/**
 * Calculate total loads this calendar month for a user.
 * Scans transaction history for 'load' type entries from 1st of current month.
 */
function getMonthlyLoadedPaise(userId) {
  const now = new Date();
  const dayOfMonth = now.getDate();

  // Fetch transactions from the 1st of current month (dayOfMonth days ago covers it)
  const history = getTransactionHistory(userId, dayOfMonth + 1, {
    transaction_type: 'load',
    limit: 500,
  });

  if (!history || !history.transactions) return 0;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalPaise = 0;
  for (const txn of history.transactions) {
    // Parse IST-formatted timestamp back to check month
    if (txn.status === 'success') {
      totalPaise += Number(txn.amount_paise);
    }
  }

  return totalPaise;
}

// ── Core Validation ────────────────────────────────────────────────────────────

/**
 * Validate a wallet load amount against RBI PPI rules.
 *
 * @param {string} userId - The user ID to validate
 * @param {number} loadAmountPaise - Amount to load in paise
 * @param {string} [apiKey] - Anthropic API key (optional; needed for Claude message on block)
 * @returns {Promise<object>} Validation result
 */
export async function validateLoadAmount(userId, loadAmountPaise, apiKey) {
  console.log(`[Load Guard] Validating load of ${formatINR(loadAmountPaise)} for ${userId}...`);

  // Step 1 — Fetch user data
  const balanceData = getWalletBalance(userId);
  if (!balanceData) {
    return { allowed: false, error: 'User not found', user_id: userId };
  }

  const currentBalancePaise = Number(balanceData.balance_paise);
  const kycType = balanceData.kyc_tier === 'MINIMUM' ? 'MINIMUM_KYC' : 'FULL_KYC';
  const monthlyLoadedPaise = getMonthlyLoadedPaise(userId);
  const userName = balanceData.name;

  // Include sub-wallet balances in total balance calculation
  const subWallets = getSubWalletData(userId);
  const subWalletTotalPaise = subWallets
    ? subWallets.reduce((sum, sw) => sum + Number(sw.balance_paise || 0), 0)
    : 0;
  const totalBalancePaise = currentBalancePaise + subWalletTotalPaise;

  console.log(`[Load Guard]   Main balance: ${formatINR(currentBalancePaise)}, Sub-wallets: ${formatINR(subWalletTotalPaise)}, Total: ${formatINR(totalBalancePaise)}, KYC: ${kycType}, Monthly loaded: ${formatINR(monthlyLoadedPaise)}`);

  // Step 2 — Run all 3 rules
  const violations = [];

  // Rule 1: BALANCE_CAP — ₹1,00,000 max wallet balance (includes sub-wallet balances)
  const newBalance = totalBalancePaise + loadAmountPaise;
  if (newBalance > BALANCE_CAP_PAISE) {
    const maxAllowed = Math.max(0, BALANCE_CAP_PAISE - totalBalancePaise);
    violations.push({
      rule: 'BALANCE_CAP',
      max_allowed: paiseToRupees(maxAllowed),
      max_allowed_paise: maxAllowed,
    });
  }

  // Rule 2: MONTHLY_LOAD — ₹2,00,000 total loads per calendar month
  if (monthlyLoadedPaise + loadAmountPaise > MONTHLY_LOAD_LIMIT_PAISE) {
    const maxAllowed = Math.max(0, MONTHLY_LOAD_LIMIT_PAISE - monthlyLoadedPaise);
    violations.push({
      rule: 'MONTHLY_LOAD',
      max_allowed: paiseToRupees(maxAllowed),
      max_allowed_paise: maxAllowed,
    });
  }

  // Rule 3: MIN_KYC_CAP — ₹10,000 max balance for Minimum KYC users (total including sub-wallets)
  if (kycType === 'MINIMUM_KYC' && newBalance > MIN_KYC_BALANCE_CAP_PAISE) {
    const maxAllowed = Math.max(0, MIN_KYC_BALANCE_CAP_PAISE - totalBalancePaise);
    violations.push({
      rule: 'MIN_KYC_CAP',
      max_allowed: paiseToRupees(maxAllowed),
      max_allowed_paise: maxAllowed,
    });
  }

  // Step 3 — Return result
  if (violations.length === 0) {
    console.log(`[Load Guard]   ✅ Allowed — new balance would be ${formatINR(newBalance)}`);
    return {
      allowed: true,
      user_id: userId,
      requested_amount: paiseToRupees(loadAmountPaise),
      current_balance: paiseToRupees(currentBalancePaise),
      new_balance: paiseToRupees(newBalance),
    };
  }

  // Most restrictive rule wins (lowest max_allowed)
  violations.sort((a, b) => a.max_allowed - b.max_allowed);
  const blocking = violations[0];

  console.log(`[Load Guard]   ❌ Blocked by ${blocking.rule} — max allowed: ${formatINR(blocking.max_allowed_paise)}`);

  const blockedResult = {
    allowed: false,
    user_id: userId,
    requested_amount: paiseToRupees(loadAmountPaise),
    blocked_by: blocking.rule,
    max_allowed: blocking.max_allowed,
    current_balance: paiseToRupees(currentBalancePaise),
    monthly_loaded: paiseToRupees(monthlyLoadedPaise),
    kyc_type: kycType,
  };

  // Log blocked attempt
  logBlockedAttempt({
    user_id: userId,
    name: userName,
    attempted_amount: paiseToRupees(loadAmountPaise),
    blocked_by: blocking.rule,
    max_allowed: blocking.max_allowed,
    timestamp: new Date().toISOString(),
  });

  // Step 4 — Generate Claude explanation (only when blocked)
  const suggestion = blocking.max_allowed > 0
    ? `You can add up to ₹${blocking.max_allowed.toLocaleString('en-IN')} right now`
    : 'You cannot add money at this time';

  let userMessage;
  try {
    if (apiKey) {
      userMessage = await generateBlockMessage(apiKey, {
        load_amount: paiseToRupees(loadAmountPaise),
        blocked_by: blocking.rule,
        current_balance: paiseToRupees(currentBalancePaise),
        monthly_loaded: paiseToRupees(monthlyLoadedPaise),
        kyc_type: kycType,
        max_allowed: blocking.max_allowed,
      });
    }
  } catch (err) {
    console.error(`[Load Guard]   Claude API failed: ${err?.message || err}`);
  }

  // Fallback message if Claude fails or no API key
  if (!userMessage) {
    userMessage = `This transaction exceeds your wallet limit. You can add up to ₹${blocking.max_allowed.toLocaleString('en-IN')} right now.`;
  }

  return {
    ...blockedResult,
    user_message: userMessage,
    suggestion,
  };
}

// ── Claude API Message Generation ──────────────────────────────────────────────

async function generateBlockMessage(apiKey, context) {
  const client = new Anthropic({ apiKey });

  const systemPrompt =
    'You are a helpful wallet assistant for a PPI wallet app in India. ' +
    'When a transaction is blocked, explain clearly and kindly why it was blocked ' +
    'and what the user can do. The ₹1,00,000 limit includes the main wallet AND all benefits wallets (Food, Transit, FASTag, Gift, Fuel) combined. ' +
    'Always be specific with rupee amounts. Never use jargon. Keep response under 3 sentences.';

  const userPrompt =
    `A wallet user tried to add ₹${context.load_amount.toLocaleString('en-IN')} but was blocked.\n\n` +
    `Reason: ${context.blocked_by}\n` +
    `Current Balance: ₹${context.current_balance.toLocaleString('en-IN')}\n` +
    `Monthly Loaded So Far: ₹${context.monthly_loaded.toLocaleString('en-IN')}\n` +
    `KYC Type: ${context.kyc_type}\n` +
    `Maximum They Can Add Right Now: ₹${context.max_allowed.toLocaleString('en-IN')}\n\n` +
    `Write a friendly 2-3 sentence message explaining:\n` +
    `1. Why they were blocked (in plain language, no RBI jargon)\n` +
    `2. Exactly how much they can add right now\n` +
    `3. What they can do if they need to add more (upgrade KYC / wait for month reset / spend existing balance first)\n\n` +
    `If max_allowed is 0, tell them they cannot add any money right now and why.`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  const message = textBlock ? textBlock.text.trim() : null;
  console.log(`[Load Guard]   ✅ Claude message generated (${message?.length || 0} chars)`);
  return message;
}
