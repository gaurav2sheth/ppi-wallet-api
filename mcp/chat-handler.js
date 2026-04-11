/**
 * Agentic Chat Handler
 *
 * Receives a natural language question, calls Claude API with the MCP
 * wallet tool definitions, executes any tool calls against mock-data,
 * and returns Claude's final text response.
 *
 * Used by both the wallet app and admin dashboard Vite middlewares.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  getWalletBalance,
  getTransactionHistory,
  flagSuspiciousTransaction,
  unflagTransaction,
  listUsers,
  getSpendingSummary,
  searchTransactions,
  getUserProfile,
  compareSpending,
  detectRecurringPayments,
  compareUsers,
  generateReport,
  addMoney, payMerchant, transferP2P, payBill, requestRefund,
  checkCompliance,
  raiseDispute, getDisputeStatus, getRefundStatus,
  getNotifications, setAlertThreshold,
  approveKyc, rejectKyc, requestKycUpgrade,
  getPeakUsage, getMonthlyTrends,
  queryKycExpiry, generateKycRenewalReport,
} from './mock-data.js';

// ── Tool definitions matching the MCP server schema ──────────────────────────
const TOOLS = [
  {
    name: 'get_wallet_balance',
    description: 'Retrieves the current INR balance and account status for a PPI wallet user. Set include_runway=true to estimate how long the balance will last. Use this when the user asks about their balance, account standing, or "how long will my money last?".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID (e.g. user_001)' },
        include_runway: { type: 'boolean', description: 'Include balance runway estimation (avg daily spend, days remaining)', default: false },
        lookback_days: { type: 'number', description: 'Days to calculate average spending for runway (default: 30)', default: 30 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_transaction_history',
    description: 'Fetches wallet transactions for a user over a specified number of days. IMPORTANT: Always set the limit parameter when the user asks for a specific number of transactions (e.g. "last 5" → limit=5). Use entry_type to filter credit (money in) vs debit (money out). Use transaction_type to filter by load/pay/transfer.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID (e.g. user_001)' },
        days: { type: 'number', description: 'Number of past days to fetch (e.g. 7, 30)', default: 7 },
        entry_type: { type: 'string', enum: ['credit', 'debit'], description: 'Filter by entry type: credit (money in) or debit (money out)' },
        transaction_type: { type: 'string', enum: ['load', 'pay', 'transfer'], description: 'Filter by transaction type' },
        limit: { type: 'number', description: 'Maximum number of transactions to return (default: 10)' },
        offset: { type: 'number', description: 'Skip first N results for pagination (default: 0)' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'flag_suspicious_transaction',
    description: 'Marks a specific transaction as suspicious and logs the reason.',
    input_schema: {
      type: 'object',
      properties: {
        txn_id: { type: 'string', description: 'Transaction ID to flag (e.g. txn_004)' },
        reason: { type: 'string', description: "Reason for flagging" },
      },
      required: ['txn_id', 'reason'],
    },
  },
  {
    name: 'unflag_transaction',
    description: 'Removes the suspicious flag from a previously flagged transaction. Use when a flagged transaction has been reviewed and cleared.',
    input_schema: {
      type: 'object',
      properties: {
        txn_id: { type: 'string', description: 'Transaction ID to unflag (e.g. txn_004)' },
        reason: { type: 'string', description: 'Reason for unflagging' },
      },
      required: ['txn_id', 'reason'],
    },
  },
  {
    name: 'list_users',
    description: 'Lists all wallet users with their ID, name, status, and balance.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_spending_summary',
    description: 'Returns spending breakdown for a user. Use group_by="category" (default) for category analysis, or group_by="merchant" for top merchant insights. Use this for "how much did I spend on food?", "where is my money going?", "top merchants".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        days: { type: 'number', description: 'Number of past days to analyze (default: 30)', default: 30 },
        group_by: { type: 'string', enum: ['category', 'merchant'], description: 'Group by category or merchant (default: category)', default: 'category' },
        top_n: { type: 'number', description: 'Number of top items when group_by=merchant (default: 10)', default: 10 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'search_transactions',
    description: 'Searches transactions by merchant name, description keyword, or amount range. Supports limit for pagination.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        query: { type: 'string', description: 'Search keyword (e.g. "Swiggy", "food")' },
        min_amount: { type: 'number', description: 'Minimum amount in rupees' },
        max_amount: { type: 'number', description: 'Maximum amount in rupees' },
        days: { type: 'number', description: 'Number of past days (default: 30)', default: 30 },
        limit: { type: 'number', description: 'Maximum results to return (default: 20)' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_user_profile',
    description: 'Returns full user profile including KYC tier, account limits, account age, and recent activity stats. Set include_limits=true for real-time limit utilization. Use for "what are my limits?", "how much can I spend?".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        include_limits: { type: 'boolean', description: 'Include real-time limit utilization (daily, monthly, balance, P2P)', default: false },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'compare_spending',
    description: 'Compares spending between two consecutive time periods. Handles zero-activity periods gracefully.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        period1_days: { type: 'number', description: 'Days for recent period (default: 7)', default: 7 },
        period2_days: { type: 'number', description: 'Days for comparison period (default: 7)', default: 7 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'detect_recurring_payments',
    description: 'Detects recurring/subscription payments by analyzing merchant payment patterns. Use for "what are my subscriptions?", "recurring charges".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        days: { type: 'number', description: 'Past days to analyze (default: 90)', default: 90 },
        min_occurrences: { type: 'number', description: 'Minimum payments to count as recurring (default: 2)', default: 2 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'compare_users',
    description: '[Admin-only] Compares multiple users side-by-side on balance, spending, income, and activity.',
    input_schema: {
      type: 'object',
      properties: {
        user_ids: { type: 'array', items: { type: 'string' }, description: 'Array of user IDs to compare' },
        days: { type: 'number', description: 'Past days to analyze (default: 30)', default: 30 },
      },
      required: ['user_ids'],
    },
  },
  {
    name: 'generate_report',
    description: 'Generates a comprehensive report: "summary" (overview), "detailed" (full breakdown), or "risk" (risk-focused).',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        days: { type: 'number', description: 'Past days to cover (default: 30)', default: 30 },
        report_type: { type: 'string', enum: ['summary', 'detailed', 'risk'], description: 'Report type', default: 'summary' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'add_money',
    description: 'Adds money to a user\'s wallet. Validates KYC balance limits. Use for "add money", "top up", "load wallet".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        amount_paise: { type: 'number', description: 'Amount in paise (e.g. 100000 for ₹1,000)' },
        source: { type: 'string', description: 'Payment source (UPI, Debit Card, NEFT)', default: 'UPI' },
      },
      required: ['user_id', 'amount_paise'],
    },
  },
  {
    name: 'pay_merchant',
    description: 'Makes a payment to a merchant from wallet. Checks balance. Use for "pay Swiggy ₹500", "make payment".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        amount_paise: { type: 'number', description: 'Payment amount in paise' },
        merchant_name: { type: 'string', description: 'Merchant name' },
        description: { type: 'string', description: 'Payment description' },
      },
      required: ['user_id', 'amount_paise', 'merchant_name'],
    },
  },
  {
    name: 'transfer_p2p',
    description: 'Transfers money from one wallet user to another. Validates balance and P2P limits. Use for "send money to Priya", "transfer ₹1000".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Sender wallet user ID' },
        recipient_id: { type: 'string', description: 'Recipient wallet user ID' },
        amount_paise: { type: 'number', description: 'Transfer amount in paise' },
        note: { type: 'string', description: 'Optional transfer note' },
      },
      required: ['user_id', 'recipient_id', 'amount_paise'],
    },
  },
  {
    name: 'pay_bill',
    description: 'Pays a bill (electricity, phone, etc.) from wallet. Use for "pay electricity bill", "pay my Jio recharge".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        amount_paise: { type: 'number', description: 'Bill amount in paise' },
        biller_name: { type: 'string', description: 'Biller name (MSEB, Jio, Airtel)' },
        bill_number: { type: 'string', description: 'Bill or account number' },
        category: { type: 'string', description: 'Bill category', default: 'Utilities' },
      },
      required: ['user_id', 'amount_paise', 'biller_name'],
    },
  },
  {
    name: 'request_refund',
    description: 'Initiates a refund for a transaction. Only debit transactions can be refunded. Use for "refund my payment", "I want a refund".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        txn_id: { type: 'string', description: 'Transaction ID to refund' },
        reason: { type: 'string', description: 'Reason for refund' },
      },
      required: ['user_id', 'txn_id', 'reason'],
    },
  },
  {
    name: 'check_compliance',
    description: 'Runs RBI PPI compliance checks: balance limits, KYC state, Aadhaar, flagged transactions. Set include_risk_score=true for 0-100 risk assessment. Use for "is this user compliant?", "risk profile", "compliance check".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        include_risk_score: { type: 'boolean', description: 'Include 0-100 risk score with risk factors and activity summary', default: false },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'raise_dispute',
    description: 'Files a dispute for a transaction. Use for "dispute this transaction", "file a complaint".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        txn_id: { type: 'string', description: 'Transaction ID to dispute' },
        type: { type: 'string', enum: ['failed_transaction', 'unauthorized', 'wrong_amount', 'merchant_issue', 'other'], description: 'Dispute type', default: 'failed_transaction' },
        description: { type: 'string', description: 'Description of the issue' },
      },
      required: ['user_id', 'txn_id', 'description'],
    },
  },
  {
    name: 'get_dispute_status',
    description: 'Gets dispute status or lists all disputes for a user. Use for "dispute status", "show my disputes".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        dispute_id: { type: 'string', description: 'Specific dispute ID (omit to list all)' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_refund_status',
    description: 'Gets refund status or lists all refunds for a user. Use for "where is my refund?", "refund status".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        refund_id: { type: 'string', description: 'Specific refund ID (omit to list all)' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_notifications',
    description: 'Retrieves notifications for a user. Use for "show notifications", "any alerts?", "unread messages".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        unread_only: { type: 'boolean', description: 'Show only unread notifications', default: false },
        limit: { type: 'number', description: 'Max notifications to return', default: 20 },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'set_alert_threshold',
    description: 'Sets alert thresholds: low balance, high transaction, daily spend. Amounts in rupees. Use for "alert me when balance below ₹500".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        low_balance: { type: 'number', description: 'Low balance threshold in rupees' },
        high_transaction: { type: 'number', description: 'High transaction alert in rupees' },
        daily_spend: { type: 'number', description: 'Daily spend limit alert in rupees' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'approve_kyc',
    description: 'Admin: Approves a pending Full KYC application. Only for FULL_KYC_PENDING users. Use for "approve KYC for user_007".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID to approve' },
        admin_notes: { type: 'string', description: 'Optional admin notes' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'reject_kyc',
    description: 'Admin: Rejects a pending Full KYC application with reason. Only for FULL_KYC_PENDING users. Use for "reject KYC for user_007".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID to reject' },
        reason: { type: 'string', description: 'Rejection reason' },
      },
      required: ['user_id', 'reason'],
    },
  },
  {
    name: 'request_kyc_upgrade',
    description: 'Initiates KYC upgrade from MIN_KYC to FULL_KYC. Use for "upgrade my KYC", "I want full KYC".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'User ID to upgrade' },
      },
      required: ['user_id'],
    },
  },
  {
    name: 'get_peak_usage',
    description: '[Admin-only] Platform-wide peak usage analysis: busiest hours, days, transaction types. Use for "peak usage", "busiest time".',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Past days to analyze', default: 30 },
      },
      required: [],
    },
  },
  {
    name: 'get_monthly_trends',
    description: '[Admin-only] Month-over-month platform trends: volumes, active users, growth. Use for "monthly growth", "trends".',
    input_schema: {
      type: 'object',
      properties: {
        months: { type: 'number', description: 'Months to analyze', default: 3 },
      },
      required: [],
    },
  },
  {
    name: 'query_kyc_expiry',
    description: 'Flexible query for KYC expiry with date ranges, state filters, urgency bands, balance thresholds, and aggregations. Use for "expiring KYC", "critical KYC renewals", "KYC expiry between dates".',
    input_schema: {
      type: 'object',
      properties: {
        from_date: { type: 'string', description: 'Start date for expiry range (ISO format)' },
        to_date: { type: 'string', description: 'End date for expiry range (ISO format)' },
        kyc_state: { type: 'string', description: 'Filter by KYC state' },
        wallet_state: { type: 'string', description: 'Filter by wallet state' },
        min_balance: { type: 'string', description: 'Minimum balance in paise' },
        include_inactive: { type: 'boolean', description: 'Include inactive wallets', default: false },
        include_expired: { type: 'boolean', description: 'Include already-expired users', default: false },
        urgency: { type: 'string', enum: ['expired', 'critical', 'warning', 'upcoming', 'safe'], description: 'Filter by urgency band' },
        sort_by: { type: 'string', enum: ['expiry_date', 'balance', 'name'], description: 'Sort order', default: 'expiry_date' },
        limit: { type: 'number', description: 'Max results', default: 50 },
      },
      required: [],
    },
  },
  {
    name: 'generate_kyc_renewal_report',
    description: 'Comprehensive KYC renewal compliance report with executive summary, financial impact, urgency breakdown, and RBI recommendations. Use for "KYC report", "compliance audit", "renewal report".',
    input_schema: {
      type: 'object',
      properties: {
        days_ahead: { type: 'number', description: 'Look-ahead window for renewals', default: 90 },
        report_format: { type: 'string', enum: ['summary', 'detailed'], description: 'Report detail level', default: 'detailed' },
      },
      required: [],
    },
  },
];

// ── Execute a tool call against the mock data layer ──────────────────────────
function executeTool(name, input) {
  switch (name) {
    case 'get_wallet_balance': {
      const result = getWalletBalance(input.user_id, { include_runway: input.include_runway ?? false, lookback_days: input.lookback_days ?? 30 });
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'get_transaction_history': {
      const result = getTransactionHistory(input.user_id, input.days ?? 7, {
        entry_type: input.entry_type,
        transaction_type: input.transaction_type,
        limit: input.limit,
        offset: input.offset ?? 0,
      });
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'flag_suspicious_transaction': {
      const result = flagSuspiciousTransaction(input.txn_id, input.reason);
      return result ?? { error: 'Transaction not found', txn_id: input.txn_id };
    }
    case 'unflag_transaction': {
      const result = unflagTransaction(input.txn_id, input.reason);
      return result ?? { error: 'Transaction not found', txn_id: input.txn_id };
    }
    case 'list_users': {
      return listUsers();
    }
    case 'get_spending_summary': {
      const result = getSpendingSummary(input.user_id, input.days ?? 30, { group_by: input.group_by ?? 'category', top_n: input.top_n ?? 10 });
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'search_transactions': {
      const result = searchTransactions(input.user_id, {
        query: input.query,
        min_amount: input.min_amount,
        max_amount: input.max_amount,
        days: input.days ?? 30,
        limit: input.limit,
      });
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'get_user_profile': {
      const result = getUserProfile(input.user_id, { include_limits: input.include_limits ?? false });
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'compare_spending': {
      const result = compareSpending(input.user_id, {
        period1_days: input.period1_days ?? 7,
        period2_days: input.period2_days ?? 7,
      });
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'detect_recurring_payments': {
      const result = detectRecurringPayments(input.user_id, {
        days: input.days ?? 90,
        min_occurrences: input.min_occurrences ?? 2,
      });
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'compare_users': {
      return compareUsers(input.user_ids, { days: input.days ?? 30 });
    }
    case 'generate_report': {
      const result = generateReport(input.user_id, {
        days: input.days ?? 30,
        report_type: input.report_type ?? 'summary',
      });
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'add_money': {
      return addMoney(input.user_id, { amount_paise: input.amount_paise, source: input.source ?? 'UPI' });
    }
    case 'pay_merchant': {
      return payMerchant(input.user_id, { amount_paise: input.amount_paise, merchant_name: input.merchant_name, description: input.description });
    }
    case 'transfer_p2p': {
      return transferP2P(input.user_id, { amount_paise: input.amount_paise, recipient_id: input.recipient_id, note: input.note });
    }
    case 'pay_bill': {
      return payBill(input.user_id, { amount_paise: input.amount_paise, biller_name: input.biller_name, bill_number: input.bill_number, category: input.category ?? 'Utilities' });
    }
    case 'request_refund': {
      return requestRefund(input.user_id, { txn_id: input.txn_id, reason: input.reason });
    }
    case 'check_compliance': {
      return checkCompliance(input.user_id, { include_risk_score: input.include_risk_score ?? false });
    }
    case 'raise_dispute': {
      return raiseDispute(input.user_id, { txn_id: input.txn_id, type: input.type ?? 'failed_transaction', description: input.description });
    }
    case 'get_dispute_status': {
      return getDisputeStatus(input.user_id, { dispute_id: input.dispute_id });
    }
    case 'get_refund_status': {
      return getRefundStatus(input.user_id, { refund_id: input.refund_id });
    }
    case 'get_notifications': {
      return getNotifications(input.user_id, { unread_only: input.unread_only ?? false, limit: input.limit ?? 20 });
    }
    case 'set_alert_threshold': {
      return setAlertThreshold(input.user_id, { low_balance: input.low_balance, high_transaction: input.high_transaction, daily_spend: input.daily_spend });
    }
    case 'approve_kyc': {
      return approveKyc(input.user_id, { admin_notes: input.admin_notes });
    }
    case 'reject_kyc': {
      return rejectKyc(input.user_id, { reason: input.reason });
    }
    case 'request_kyc_upgrade': {
      return requestKycUpgrade(input.user_id);
    }
    case 'get_peak_usage': {
      return getPeakUsage({ days: input.days ?? 30 });
    }
    case 'get_monthly_trends': {
      return getMonthlyTrends({ months: input.months ?? 3 });
    }
    case 'query_kyc_expiry': {
      return queryKycExpiry({
        from_date: input.from_date,
        to_date: input.to_date,
        kyc_state: input.kyc_state,
        wallet_state: input.wallet_state,
        min_balance: input.min_balance,
        include_inactive: input.include_inactive ?? false,
        include_expired: input.include_expired ?? false,
        urgency: input.urgency,
        sort_by: input.sort_by ?? 'expiry_date',
        limit: input.limit ?? 50,
      });
    }
    case 'generate_kyc_renewal_report': {
      return generateKycRenewalReport({
        days_ahead: input.days_ahead ?? 90,
        report_format: input.report_format ?? 'detailed',
      });
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

/**
 * Handle a natural language chat message.
 *
 * @param {string} message - The user's question
 * @param {string} apiKey - Anthropic API key
 * @param {'user' | 'admin'} role - Whether this is a user or admin query
 * @param {object} [context] - App context (balance, transactions) from frontend
 * @returns {Promise<string>} Claude's text response
 */
export async function handleChat(message, apiKey, role = 'user', context = null) {
  const client = new Anthropic({ apiKey });

  let systemPrompt;

  if (role === 'admin') {
    let contextBlock = '';
    if (context) {
      contextBlock = `\n\n<app_context>
The dashboard currently shows ${context.total_users || 'N/A'} total users and ${context.total_transactions || 'N/A'} total transactions.

Top users visible in dashboard:
${(context.users || []).slice(0, 10).map(u => `- ${u.name} | ${u.wallet_id} | ${u.balance} | ${u.wallet_state} | KYC: ${u.kyc_state}`).join('\n')}

Recent transactions visible in dashboard:
${(context.recent_transactions || []).slice(0, 10).map(t => `- ${t.amount} | ${t.saga_type} | ${t.user_name} | ${t.status} | ${t.description}`).join('\n')}
</app_context>

IMPORTANT: When answering questions about users, transactions, or statistics, use the data from <app_context> above since that is what the admin sees on their screen. Only use tools for deeper analysis or operations not available in the context.`;
    }

    systemPrompt = `You are an AI assistant for a PPI wallet admin dashboard in India. You help admins analyze users, transactions, identify fraud, and generate reports.

GUIDELINES:
- Use INR formatting (₹). Be concise, professional, data-driven.
- When the admin asks about users or transactions visible on the dashboard, reference the app context data.
- For deeper queries (risk profiles, comparisons, flagging), use the available tools.
- When asked for a specific number of items (e.g. "last 5", "top 3"), ALWAYS set the limit parameter accordingly.
- When asked about spending, categories, or patterns, use get_spending_summary or search_transactions.
- Parse natural language filters: "debit" → entry_type=debit, "credits" → entry_type=credit, "Swiggy" → query="Swiggy".
- For "who spent the most?" or comparisons, use compare_users with relevant user_ids.
- Format responses with bullet points and bold for key numbers.${contextBlock}`;

  } else {
    let contextBlock = '';
    if (context) {
      const txnLines = (context.recent_transactions || []).slice(0, 10).map(t => {
        const sign = t.entry_type === 'CREDIT' ? '+' : '-';
        return `- ${sign}${t.amount_formatted} | ${t.description} | ${t.transaction_type} | ${t.days_ago}d ago`;
      }).join('\n');

      contextBlock = `\n\n<app_context>
The user's wallet currently shows:
- Balance: ${context.balance_formatted}
- Name: ${context.user_name}
- KYC: ${context.kyc_tier}

Recent transactions visible in the app:
${txnLines}
</app_context>

IMPORTANT: When answering questions about balance, transactions, or spending, use the data from <app_context> above since that is what the user sees on their screen. This ensures your answers match the app exactly. Only use tools for deeper analysis (spending breakdown, recurring payments, runway estimation) that goes beyond what's in the context.`;
    }

    systemPrompt = `You are a friendly AI assistant for a PPI wallet app in India. You help users understand their finances.

GUIDELINES:
- Use INR formatting (₹). Be concise, friendly, and helpful.
- The current user is user_001. When they say "my balance" or "my transactions", use user_001.
- When asked for a specific count (e.g. "last 3 transactions", "top 5"), ALWAYS set the limit parameter to that exact number.
- Parse natural language filters:
  - "debit/payments/spent" → entry_type=debit
  - "credit/received/top-ups" → entry_type=credit
  - "Swiggy orders" → use search_transactions with query="Swiggy"
  - "above ₹500" → min_amount=500
- For balance questions, respond immediately from context if available.
- For spending analysis, categories, trends → use get_spending_summary.
- For "subscriptions" or "recurring" → use detect_recurring_payments.
- For "how long will my money last" → use estimate_balance_runway.
- Format responses with bullet points. Use bold for amounts.${contextBlock}`;
  }

  let messages = [{ role: 'user', content: message }];

  // Agentic loop: keep calling Claude until we get a final text response
  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'end_turn' || !response.content.some(b => b.type === 'tool_use')) {
      const textBlocks = response.content.filter(b => b.type === 'text');
      return textBlocks.map(b => b.text).join('\n') || 'No response generated.';
    }

    const toolResults = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = executeTool(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result, null, 2),
        });
      }
    }

    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'user', content: toolResults });
  }

  return 'I was unable to complete the request after multiple steps. Please try again.';
}
