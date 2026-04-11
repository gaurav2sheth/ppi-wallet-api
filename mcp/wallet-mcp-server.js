/**
 * PPI Wallet MCP Server
 *
 * A Model Context Protocol server that exposes 35 tools for Claude:
 *   Wallet, transactions, analytics, KYC, compliance, disputes, notifications, and admin tools.
 *
 * Runs over stdio transport so Claude Desktop can connect directly.
 *
 * Usage:
 *   node wallet-mcp-server.js
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';  // Bundled with @modelcontextprotocol/sdk
import {
  getWalletBalance,
  getTransactionHistory,
  flagSuspiciousTransaction,
  unflagTransaction,
  getSpendingSummary,
  searchTransactions,
  getUserProfile,
  compareSpending,
  detectRecurringPayments,
  compareUsers,
  generateReport,
  // Admin tools
  getSystemStats,
  searchUsers,
  getFlaggedTransactions,
  suspendUser,
  getFailedTransactions,
  getKycStats,
  // Transaction operations
  addMoney,
  payMerchant,
  transferP2P,
  payBill,
  requestRefund,
  // Limits & compliance (checkLimits absorbed into getUserProfile)
  checkCompliance,
  // Disputes & support
  raiseDispute,
  getDisputeStatus,
  getRefundStatus,
  // Notifications
  getNotifications,
  setAlertThreshold,
  // KYC actions (admin)
  approveKyc,
  rejectKyc,
  requestKycUpgrade,
  // Analytics (getMerchantInsights absorbed into getSpendingSummary)
  getPeakUsage,
  getMonthlyTrends,
  // KYC Expiry (getKycExpiringUsers absorbed into queryKycExpiry)
  queryKycExpiry,
  generateKycRenewalReport,
} from './mock-data.js';

// ── Create MCP Server instance ────────────────────────────────────────────────
const server = new McpServer({
  name: 'ppi-wallet',
  version: '1.0.0',
});

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 1: get_wallet_balance
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'get_wallet_balance',
  // Description — tells Claude when to use this tool
  'Retrieves the current INR balance and account status for a PPI wallet user. ' +
  'Set include_runway=true to also estimate how many days the balance will last (replaces estimate_balance_runway). ' +
  'Use this when the user asks about their balance, account standing, or "how long will my money last?".',
  // Input schema — strict validation via Zod
  {
    user_id: z.string().describe('Unique wallet user ID (e.g. user_001)'),
    include_runway: z.boolean().default(false).describe('Include balance runway estimation (avg daily spend, days remaining, exhaustion date)'),
    lookback_days: z.number().default(30).describe('Days to calculate average spending for runway estimation (default: 30)'),
  },
  // Handler — called when Claude invokes this tool
  async ({ user_id, include_runway, lookback_days }) => {
    try {
      const result = getWalletBalance(user_id, { include_runway, lookback_days });

      if (!result) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'User not found', user_id }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (err) {
      // Never let a tool crash the server — return a safe error
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Internal server error',
            message: err.message,
            user_id,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 2: get_transaction_history
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'get_transaction_history',
  // Description — tells Claude when to use this tool
  'Fetches wallet transactions for a user over a specified number of days. ' +
  'IMPORTANT: Always set the limit parameter when the user asks for a specific number of transactions (e.g. "last 5" → limit=5). ' +
  'Use entry_type to filter credit (money in) vs debit (money out). ' +
  'Use transaction_type to filter by load/pay/transfer. ' +
  'Use this for queries about spending history, recent activity, or transaction patterns.',
  // Input schema
  {
    user_id: z.string().describe('Unique wallet user ID (e.g. user_001)'),
    days: z.number().default(7).describe('Number of past days to fetch (e.g. 7, 30)'),
    entry_type: z.enum(['credit', 'debit']).optional().describe('Filter by entry type: credit (money in — loads) or debit (money out — payments, transfers)'),
    transaction_type: z.enum(['load', 'pay', 'transfer']).optional().describe('Filter by transaction type: load (top-up), pay (merchant payment), transfer (P2P transfer)'),
    limit: z.number().optional().describe('Maximum number of transactions to return (default: 10). Set this when user asks for a specific count like "last 3" or "top 5".'),
  },
  // Handler
  async ({ user_id, days, entry_type, transaction_type, limit }) => {
    try {
      const result = getTransactionHistory(user_id, days, { entry_type, transaction_type, limit });

      if (!result) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'User not found', user_id }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Internal server error',
            message: err.message,
            user_id,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 3: flag_suspicious_transaction
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'flag_suspicious_transaction',
  // Description — tells Claude when to use this tool
  'Marks a specific transaction as suspicious and logs the reason. ' +
  'Use this when a transaction shows signs of fraud, policy violation, or unusual activity.',
  // Input schema
  {
    txn_id: z.string().describe('Transaction ID to flag (e.g. txn_004)'),
    reason: z.string().describe("Reason for flagging (e.g. 'Amount exceeds RBI PPI limit of ₹10,000')"),
  },
  // Handler
  async ({ txn_id, reason }) => {
    try {
      const result = flagSuspiciousTransaction(txn_id, reason);

      if (!result) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: 'Transaction not found', txn_id }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    } catch (err) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Internal server error',
            message: err.message,
            txn_id,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 4: get_spending_summary
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'get_spending_summary',
  'Returns spending breakdown for a user. Use group_by="category" (default) for category-wise analysis, ' +
  'or group_by="merchant" for top merchant insights (replaces get_merchant_insights). ' +
  'Use this when the user asks "how much did I spend on food?", "where is my money going?", "top merchants", "favorite shops".',
  {
    user_id: z.string().describe('Unique wallet user ID (e.g. user_001)'),
    days: z.number().default(30).describe('Number of past days to analyze (default: 30)'),
    group_by: z.enum(['category', 'merchant']).default('category').describe('Group spending by category or merchant (default: category)'),
    top_n: z.number().default(10).describe('Number of top items to return when group_by=merchant (default: 10)'),
  },
  async ({ user_id, days, group_by, top_n }) => {
    try {
      const result = getSpendingSummary(user_id, days, { group_by, top_n });
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'User not found', user_id }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 5: search_transactions
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'search_transactions',
  'Searches transactions by merchant name, description keyword, or amount range. ' +
  'Use this when the user asks "show me all Swiggy orders", "transactions above ₹5000", or searches for a specific purchase.',
  {
    user_id: z.string().describe('Unique wallet user ID (e.g. user_001)'),
    query: z.string().optional().describe('Search keyword to match against merchant name, description, or category (e.g. "Swiggy", "food", "transfer")'),
    min_amount: z.number().optional().describe('Minimum transaction amount in rupees (e.g. 500)'),
    max_amount: z.number().optional().describe('Maximum transaction amount in rupees (e.g. 5000)'),
    days: z.number().default(30).describe('Number of past days to search (default: 30)'),
    limit: z.number().optional().describe('Maximum number of results to return (default: 20)'),
  },
  async ({ user_id, query, min_amount, max_amount, days, limit }) => {
    try {
      const result = searchTransactions(user_id, { query, min_amount, max_amount, days, limit });
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'User not found', user_id }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 6: get_user_profile
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'get_user_profile',
  'Returns full user profile including KYC tier, account limits, account age, and recent activity stats. ' +
  'Set include_limits=true for real-time limit utilization (daily/monthly/balance/P2P) — replaces check_limits. ' +
  'Use this when the user asks about their profile, KYC status, daily/monthly limits, "what are my limits?", or account details.',
  {
    user_id: z.string().describe('Unique wallet user ID (e.g. user_001)'),
    include_limits: z.boolean().default(false).describe('Include real-time limit utilization (daily, monthly, balance cap, P2P limits)'),
  },
  async ({ user_id, include_limits }) => {
    try {
      const result = getUserProfile(user_id, { include_limits });
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'User not found', user_id }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 7: compare_spending
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'compare_spending',
  'Compares spending between two consecutive time periods (e.g. this week vs last week). ' +
  'Use this when the user asks "am I spending more this week?", "compare my spending", or wants trend analysis.',
  {
    user_id: z.string().describe('Unique wallet user ID (e.g. user_001)'),
    period1_days: z.number().default(7).describe('Number of days for the recent period (default: 7)'),
    period2_days: z.number().default(7).describe('Number of days for the comparison period immediately before period 1 (default: 7)'),
  },
  async ({ user_id, period1_days, period2_days }) => {
    try {
      const result = compareSpending(user_id, { period1_days, period2_days });
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'User not found', user_id }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 8: unflag_transaction (estimate_balance_runway absorbed into get_wallet_balance)
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'unflag_transaction',
  'Removes the suspicious flag from a previously flagged transaction. ' +
  'Use this when a flagged transaction has been reviewed and cleared, or was flagged in error.',
  {
    txn_id: z.string().describe('Transaction ID to unflag (e.g. txn_004)'),
    reason: z.string().describe('Reason for unflagging (e.g. "Reviewed and cleared — legitimate purchase")'),
  },
  async ({ txn_id, reason }) => {
    try {
      const result = unflagTransaction(txn_id, reason);
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Transaction not found', txn_id }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 10: detect_recurring_payments
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'detect_recurring_payments',
  'Detects recurring/subscription payments for a user by analyzing merchant payment patterns. ' +
  'Use this when the user asks "what are my subscriptions?", "recurring charges", or "monthly bills".',
  {
    user_id: z.string().describe('Unique wallet user ID (e.g. user_001)'),
    days: z.number().default(90).describe('Number of past days to analyze for patterns (default: 90)'),
    min_occurrences: z.number().default(2).describe('Minimum number of payments to a merchant to be considered recurring (default: 2)'),
  },
  async ({ user_id, days, min_occurrences }) => {
    try {
      const result = detectRecurringPayments(user_id, { days, min_occurrences });
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'User not found', user_id }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 11: compare_users
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'compare_users',
  '[Admin-only] Compares multiple users side-by-side on balance, spending, income, and activity. ' +
  'Use this when an admin asks "compare Gaurav and Priya", "who spends more?", or wants a user comparison.',
  {
    user_ids: z.array(z.string()).describe('Array of user IDs to compare (e.g. ["user_001", "user_002"])'),
    days: z.number().default(30).describe('Number of past days to analyze (default: 30)'),
  },
  async ({ user_ids, days }) => {
    try {
      const result = compareUsers(user_ids, { days });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TOOL 12: generate_report
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'generate_report',
  'Generates a comprehensive report for a user. Types: "summary" (overview), "detailed" (full breakdown + transactions), "risk" (risk-focused with flagged details). ' +
  'Use this when the user asks "generate my report", "account summary", or an admin asks for a user report.',
  {
    user_id: z.string().describe('Unique wallet user ID (e.g. user_001)'),
    days: z.number().default(30).describe('Number of past days to cover (default: 30)'),
    report_type: z.enum(['summary', 'detailed', 'risk']).default('summary').describe('Report type: summary, detailed, or risk'),
  },
  async ({ user_id, days, report_type }) => {
    try {
      const result = generateReport(user_id, { days, report_type });
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'User not found', user_id }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN TOOL 1: get_system_stats
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'get_system_stats',
  'Returns platform-wide statistics: total users, active/suspended counts, total AUM (assets under management), ' +
  'transaction volumes (24h/7d/30d), KYC breakdown, and alert counts. ' +
  'Use this when an admin asks for a "platform overview", "system stats", "how many users", or "total balance".',
  {},
  async () => {
    try {
      const result = getSystemStats();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN TOOL 2: search_users
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'search_users',
  'Searches for wallet users by name, phone number, KYC tier, KYC state, account status, or balance range. ' +
  'Use this when an admin asks "show me all suspended users", "find users with minimum KYC", ' +
  '"who has balance above ₹1 lakh?", "pending KYC users", or searches for a specific person.',
  {
    query: z.string().optional().describe('Search by name, phone number, or user ID'),
    kyc_tier: z.enum(['FULL', 'MINIMUM']).optional().describe('Filter by KYC tier'),
    kyc_state: z.enum(['UNVERIFIED', 'MIN_KYC', 'FULL_KYC_PENDING', 'FULL_KYC', 'REJECTED', 'SUSPENDED']).optional().describe('Filter by KYC verification state'),
    status: z.enum(['ACTIVE', 'SUSPENDED', 'DORMANT']).optional().describe('Filter by account status'),
    min_balance: z.number().optional().describe('Minimum balance in rupees (e.g. 1000)'),
    max_balance: z.number().optional().describe('Maximum balance in rupees (e.g. 10000)'),
  },
  async ({ query, kyc_tier, kyc_state, status, min_balance, max_balance }) => {
    try {
      const result = searchUsers({ query, kyc_tier, kyc_state, status, min_balance, max_balance });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN TOOL 3: get_flagged_transactions
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'get_flagged_transactions',
  'Lists all transactions that have been flagged as suspicious across all users. ' +
  'Also shows high-value unflagged transactions as review candidates. ' +
  'Use this when an admin asks "what transactions have been flagged?", "show suspicious activity", or "any fraud alerts?".',
  {
    days: z.number().default(30).describe('Number of past days to scan for review candidates (default: 30)'),
  },
  async ({ days }) => {
    try {
      const result = getFlaggedTransactions({ days });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// (get_user_risk_profile absorbed into check_compliance with include_risk_score param)

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN TOOL 4: suspend_user
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'suspend_user',
  'Suspends or reactivates a user account with a mandatory reason. ' +
  'Use action "suspend" to disable an account or "reactivate" to re-enable a suspended account. ' +
  'Use this when an admin says "suspend Vikram Patel for KYC non-compliance" or "reactivate user_005".',
  {
    user_id: z.string().describe('User ID to suspend or reactivate (e.g. user_005)'),
    action: z.enum(['suspend', 'reactivate']).describe('Action to perform: "suspend" or "reactivate"'),
    reason: z.string().describe('Mandatory reason for the action (e.g. "KYC non-compliance", "Fraud investigation cleared")'),
  },
  async ({ user_id, action, reason }) => {
    try {
      const result = suspendUser(user_id, action, reason);
      if (!result) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'User not found', user_id }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN TOOL 6: get_failed_transactions
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'get_failed_transactions',
  'Lists all failed (and optionally pending) transactions across all users. ' +
  'Shows transaction details with user info, amounts, and failure context. ' +
  'Use this when an admin asks "show failed transactions", "any payment failures today?", or "stuck transactions".',
  {
    days: z.number().default(30).describe('Number of past days to scan (default: 30)'),
    include_pending: z.boolean().default(false).describe('Set to true to also include pending/stuck transactions'),
  },
  async ({ days, include_pending }) => {
    try {
      const result = getFailedTransactions({ days, include_pending });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN TOOL 7: get_kyc_stats
// ═══════════════════════════════════════════════════════════════════════════════
server.tool(
  'get_kyc_stats',
  'Returns platform-wide KYC statistics: distribution by state (FULL_KYC, MIN_KYC, PENDING, REJECTED), ' +
  'pending verification queue, rejected users with reasons, expiring wallets, and success/failure rates. ' +
  'Use this when an admin asks "KYC stats", "how many pending KYC?", "rejected users", "expiring wallets", or "KYC completion rate".',
  {},
  async () => {
    try {
      const result = getKycStats();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  'add_money',
  'Adds money to a user\'s wallet. Validates KYC balance limits. ' +
  'Use this when the user says "add money", "top up", "load wallet", or "recharge wallet".',
  {
    user_id: z.string().describe('Unique wallet user ID (e.g. user_001)'),
    amount_paise: z.number().describe('Amount to add in paise (e.g. 100000 for ₹1,000)'),
    source: z.string().default('UPI').describe('Payment source: UPI, Debit Card, NEFT, etc.'),
  },
  async ({ user_id, amount_paise, source }) => {
    try {
      const result = addMoney(user_id, { amount_paise, source });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'pay_merchant',
  'Makes a payment to a merchant from the user\'s wallet. Checks balance sufficiency. ' +
  'Use this when the user says "pay Swiggy ₹500", "make payment to Amazon", etc.',
  {
    user_id: z.string().describe('Unique wallet user ID'),
    amount_paise: z.number().describe('Payment amount in paise (e.g. 50000 for ₹500)'),
    merchant_name: z.string().describe('Merchant name (e.g. Swiggy, Amazon, Uber)'),
    description: z.string().optional().describe('Payment description'),
  },
  async ({ user_id, amount_paise, merchant_name, description }) => {
    try {
      const result = payMerchant(user_id, { amount_paise, merchant_name, description });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'transfer_p2p',
  'Transfers money from one wallet user to another (P2P transfer). Validates balance, P2P monthly limits, and recipient status. ' +
  'Use this when the user says "send money to Priya", "transfer ₹1000 to user_002", etc.',
  {
    user_id: z.string().describe('Sender wallet user ID'),
    recipient_id: z.string().describe('Recipient wallet user ID (e.g. user_002)'),
    amount_paise: z.number().describe('Transfer amount in paise'),
    note: z.string().optional().describe('Optional note/memo for the transfer'),
  },
  async ({ user_id, recipient_id, amount_paise, note }) => {
    try {
      const result = transferP2P(user_id, { amount_paise, recipient_id, note });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'pay_bill',
  'Pays a bill (electricity, phone, water, etc.) from the user\'s wallet. ' +
  'Use this when the user says "pay electricity bill", "pay my Jio recharge", etc.',
  {
    user_id: z.string().describe('Unique wallet user ID'),
    amount_paise: z.number().describe('Bill amount in paise'),
    biller_name: z.string().describe('Biller/utility name (e.g. MSEB, Jio, Airtel)'),
    bill_number: z.string().optional().describe('Bill or account number'),
    category: z.string().default('Utilities').describe('Bill category (Utilities, Telecom, Insurance, etc.)'),
  },
  async ({ user_id, amount_paise, biller_name, bill_number, category }) => {
    try {
      const result = payBill(user_id, { amount_paise, biller_name, bill_number, category });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'request_refund',
  'Initiates a refund request for a specific transaction. Only debit transactions can be refunded. ' +
  'Use this when the user says "refund my last payment", "I want a refund for txn_004", etc.',
  {
    user_id: z.string().describe('Unique wallet user ID'),
    txn_id: z.string().describe('Transaction ID to refund (e.g. txn_004)'),
    reason: z.string().describe('Reason for refund request'),
  },
  async ({ user_id, txn_id, reason }) => {
    try {
      const result = requestRefund(user_id, { txn_id, reason });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// LIMITS & COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════

// (check_limits absorbed into get_user_profile with include_limits param)

server.tool(
  'check_compliance',
  'Runs RBI PPI compliance checks on a user: balance limits, KYC state, Aadhaar verification, P2P usage, flagged transactions. ' +
  'Set include_risk_score=true for a 0-100 risk assessment with risk factors (replaces get_user_risk_profile). ' +
  'Use this when an admin asks "is this user compliant?", "risk profile", "compliance check for user_003", or "any regulatory issues?".',
  {
    user_id: z.string().describe('Unique wallet user ID'),
    include_risk_score: z.boolean().default(false).describe('Include 0-100 risk score with risk factors, activity summary, and flagged transaction details'),
  },
  async ({ user_id, include_risk_score }) => {
    try {
      const result = checkCompliance(user_id, { include_risk_score });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// DISPUTES & SUPPORT
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  'raise_dispute',
  'Files a dispute for a specific transaction. Checks for duplicate active disputes. ' +
  'Use this when the user says "I want to dispute this transaction", "file a complaint about txn_011", etc.',
  {
    user_id: z.string().describe('Unique wallet user ID'),
    txn_id: z.string().describe('Transaction ID to dispute'),
    type: z.enum(['failed_transaction', 'unauthorized', 'wrong_amount', 'merchant_issue', 'other']).default('failed_transaction').describe('Type of dispute'),
    description: z.string().describe('Detailed description of the issue'),
  },
  async ({ user_id, txn_id, type, description }) => {
    try {
      const result = raiseDispute(user_id, { txn_id, type, description });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'get_dispute_status',
  'Gets the status of a specific dispute or lists all disputes for a user. ' +
  'Use this when the user asks "what\'s the status of my dispute?", "show my disputes", etc.',
  {
    user_id: z.string().describe('Unique wallet user ID'),
    dispute_id: z.string().optional().describe('Specific dispute ID to check (omit to list all disputes for user)'),
  },
  async ({ user_id, dispute_id }) => {
    try {
      const result = getDisputeStatus(user_id, { dispute_id });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'get_refund_status',
  'Gets the status of a specific refund or lists all refunds for a user. ' +
  'Use this when the user asks "where is my refund?", "refund status", "show my refunds", etc.',
  {
    user_id: z.string().describe('Unique wallet user ID'),
    refund_id: z.string().optional().describe('Specific refund ID to check (omit to list all refunds for user)'),
  },
  async ({ user_id, refund_id }) => {
    try {
      const result = getRefundStatus(user_id, { refund_id });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  'get_notifications',
  'Retrieves notifications for a user. Can filter to show only unread notifications. ' +
  'Use this when the user asks "show my notifications", "any alerts?", "unread messages", etc.',
  {
    user_id: z.string().describe('Unique wallet user ID'),
    unread_only: z.boolean().default(false).describe('Set to true to show only unread notifications'),
    limit: z.number().default(20).describe('Maximum notifications to return'),
  },
  async ({ user_id, unread_only, limit }) => {
    try {
      const result = getNotifications(user_id, { unread_only, limit });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'set_alert_threshold',
  'Sets alert thresholds for a user: low balance warning, high transaction alert, daily spend limit alert. ' +
  'Amounts are in rupees (not paise). ' +
  'Use this when the user says "alert me when balance drops below ₹500", "set spending limit to ₹10,000/day", etc.',
  {
    user_id: z.string().describe('Unique wallet user ID'),
    low_balance: z.number().optional().describe('Alert when balance drops below this amount in rupees (e.g. 500)'),
    high_transaction: z.number().optional().describe('Alert for transactions above this amount in rupees (e.g. 5000)'),
    daily_spend: z.number().optional().describe('Alert when daily spending exceeds this amount in rupees (e.g. 10000)'),
  },
  async ({ user_id, low_balance, high_transaction, daily_spend }) => {
    try {
      const result = setAlertThreshold(user_id, { low_balance, high_transaction, daily_spend });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// KYC ACTIONS (ADMIN)
// ═══════════════════════════════════════════════════════════════════════════════

server.tool(
  'approve_kyc',
  'Approves a pending Full KYC application. Only works for users in FULL_KYC_PENDING state. ' +
  'Upgrades the user to FULL tier with no wallet expiry. ' +
  'Use this when an admin says "approve KYC for user_007", "approve Arjun Singh\'s KYC".',
  {
    user_id: z.string().describe('User ID to approve KYC for'),
    admin_notes: z.string().optional().describe('Optional admin notes for the approval'),
  },
  async ({ user_id, admin_notes }) => {
    try {
      const result = approveKyc(user_id, { admin_notes });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'reject_kyc',
  'Rejects a pending Full KYC application with a mandatory reason. Only works for FULL_KYC_PENDING state. ' +
  'Use this when an admin says "reject KYC for user_007", "deny Arjun\'s KYC — documents unclear".',
  {
    user_id: z.string().describe('User ID to reject KYC for'),
    reason: z.string().describe('Mandatory reason for rejection (e.g. "Document mismatch", "Blurry photo")'),
  },
  async ({ user_id, reason }) => {
    try {
      const result = rejectKyc(user_id, { reason });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'request_kyc_upgrade',
  'Initiates a KYC upgrade from MIN_KYC to FULL_KYC. Changes state to FULL_KYC_PENDING. ' +
  'Use this when a user says "upgrade my KYC", "I want full KYC", or an admin initiates an upgrade.',
  {
    user_id: z.string().describe('User ID to upgrade KYC for'),
  },
  async ({ user_id }) => {
    try {
      const result = requestKycUpgrade(user_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], ...(result.error ? { isError: true } : {}) };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

// (get_merchant_insights absorbed into get_spending_summary with group_by='merchant' param)

server.tool(
  'get_peak_usage',
  '[Admin-only] Analyzes platform-wide transaction patterns: peak hours, busiest days, and transaction type breakdown. ' +
  'Use this when an admin asks "when is peak usage?", "busiest time of day?", "transaction patterns".',
  {
    days: z.number().default(30).describe('Past days to analyze (default: 30)'),
  },
  async ({ days }) => {
    try {
      const result = getPeakUsage({ days });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'get_monthly_trends',
  '[Admin-only] Shows month-over-month platform trends: transaction counts, volumes, active users, and growth rates. ' +
  'Use this when an admin asks "monthly growth", "how are we trending?", "month over month comparison".',
  {
    months: z.number().default(3).describe('Number of months to analyze (default: 3)'),
  },
  async ({ months }) => {
    try {
      const result = getMonthlyTrends({ months });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ── KYC Expiry Tools (get_kyc_expiring_users absorbed into query_kyc_expiry) ─

server.tool(
  'query_kyc_expiry',
  'Flexible query for KYC expiry information with date ranges, state filters, balance thresholds, urgency bands, and aggregations. ' +
  'Replaces get_kyc_expiring_users — use urgency param to filter by band (expired/critical/warning/upcoming). ' +
  'Use when asked "KYC expiry between dates", "expiring KYC users", "critical KYC renewals", "KYC database query".',
  {
    from_date: z.string().optional().describe('Start date for expiry range (ISO format)'),
    to_date: z.string().optional().describe('End date for expiry range (ISO format)'),
    kyc_state: z.string().optional().describe('Filter by KYC state (e.g., MIN_KYC, FULL_KYC_PENDING)'),
    wallet_state: z.string().optional().describe('Filter by wallet state (ACTIVE, SUSPENDED, etc.)'),
    min_balance: z.string().optional().describe('Minimum balance in paise'),
    include_inactive: z.boolean().default(false).describe('Include inactive/suspended wallets'),
    include_expired: z.boolean().default(false).describe('Include already-expired users'),
    urgency: z.enum(['expired', 'critical', 'warning', 'upcoming', 'safe']).optional().describe('Filter by urgency band: expired, critical (≤7d), warning (≤30d), upcoming (≤90d), safe (>90d)'),
    sort_by: z.enum(['expiry_date', 'balance', 'name']).default('expiry_date').describe('Sort results by expiry date, balance, or name'),
    limit: z.number().default(50).describe('Max results to return'),
  },
  async ({ from_date, to_date, kyc_state, wallet_state, min_balance, include_inactive, include_expired, urgency, sort_by, limit }) => {
    try {
      const result = queryKycExpiry({ from_date, to_date, kyc_state, wallet_state, min_balance, include_inactive, include_expired, urgency, sort_by, limit });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

server.tool(
  'generate_kyc_renewal_report',
  'Generates a comprehensive KYC renewal compliance report with executive summary, urgency breakdown, financial impact, and RBI compliance recommendations. ' +
  'Use when asked "KYC renewal report", "compliance report", "KYC audit", "upcoming renewals report".',
  {
    days_ahead: z.number().default(90).describe('Look-ahead window for renewals (default: 90 days)'),
    report_format: z.enum(['summary', 'detailed']).default('detailed').describe('Report detail level'),
  },
  async ({ days_ahead, report_format }) => {
    try {
      const result = generateKycRenewalReport({ days_ahead, report_format });
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Internal server error', message: err.message }, null, 2) }], isError: true };
    }
  }
);

// ── Start the server over stdio transport ─────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't interfere with MCP's stdout protocol
  console.error('[PPI Wallet MCP] Server started — waiting for Claude connection via stdio');
}

main().catch((err) => {
  console.error('[PPI Wallet MCP] Fatal error:', err);
  process.exit(1);
});
