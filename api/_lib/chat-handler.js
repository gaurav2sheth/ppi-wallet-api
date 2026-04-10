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
  estimateBalanceRunway,
  detectRecurringPayments,
  compareUsers,
  generateReport,
} from './mock-data.js';

// ── Tool definitions matching the MCP server schema ──────────────────────────
const TOOLS = [
  {
    name: 'get_wallet_balance',
    description: 'Retrieves the current INR balance and account status for a PPI wallet user. Use this when the user asks about their balance or account standing.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID (e.g. user_001)' },
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
    description: 'Returns a category-wise spending breakdown with income section and net flow. Use this for "how much did I spend on food?", "where is my money going?".',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        days: { type: 'number', description: 'Number of past days to analyze (default: 30)', default: 30 },
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
    description: 'Returns full user profile including KYC tier, account limits, account age, and recent activity stats.',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
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
    name: 'estimate_balance_runway',
    description: 'Estimates how many days the balance will last. Warns for low absolute balance (<₹1,000).',
    input_schema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Unique wallet user ID' },
        lookback_days: { type: 'number', description: 'Days to calculate average spending (default: 30)', default: 30 },
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
    description: 'Compares multiple users side-by-side on balance, spending, income, and activity.',
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
];

// ── Execute a tool call against the mock data layer ──────────────────────────
function executeTool(name, input) {
  switch (name) {
    case 'get_wallet_balance': {
      const result = getWalletBalance(input.user_id);
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
      const result = getSpendingSummary(input.user_id, input.days ?? 30);
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
      const result = getUserProfile(input.user_id);
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'compare_spending': {
      const result = compareSpending(input.user_id, {
        period1_days: input.period1_days ?? 7,
        period2_days: input.period2_days ?? 7,
      });
      return result ?? { error: 'User not found', user_id: input.user_id };
    }
    case 'estimate_balance_runway': {
      const result = estimateBalanceRunway(input.user_id, {
        lookback_days: input.lookback_days ?? 30,
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
 * @returns {Promise<string>} Claude's text response
 */
export async function handleChat(message, apiKey, role = 'user') {
  const client = new Anthropic({ apiKey });

  const systemPrompt = role === 'admin'
    ? `You are an AI assistant for a PPI wallet admin dashboard in India. You have access to tools that can look up any wallet user's balance, transaction history, flag suspicious transactions, compare users, and generate reports. Use INR formatting. Be concise and professional. When asked about users, use the list_users tool first to find the right user_id, then use other tools. Available users: user_001 to user_010.`
    : `You are a friendly AI assistant for a PPI wallet app in India. You help users check their balance, review transactions, understand their spending, detect subscriptions, and forecast balance runway. Use INR formatting. Be concise and helpful. The current user is user_001 (Gaurav Sheth). When the user asks about "my" balance or transactions, use user_001.`;

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
