/**
 * Customer Support Agent — Dynamic AI Agent for PPI Wallet
 *
 * Unlike the KYC agent which follows fixed steps, this agent decides its own
 * tool sequence based on what the user asks.
 *
 * Architecture: UNDERSTAND → INVESTIGATE → RESOLVE → RESPOND → (ESCALATE if needed)
 *
 * Usage:
 *   import { handleSupportChat } from './customer-support-agent.js';
 *   const result = await handleSupportChat(userId, message, sessionId, apiKey);
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  getWalletBalance,
  getTransactionHistory,
  getSubWalletData,
  getUserProfile,
  searchTransactions,
  getNotifications,
  checkCompliance,
} from '../mock-data.js';
import { getBlockedAttempts } from '../services/wallet-load-guard.js';
import { escalateToOps, getEscalations } from './escalation-manager.js';
import { getNotificationsByUser, markNotificationRead } from './kyc-upgrade-agent.js';
import { createTicket, getUserTickets } from './support-ticket-manager.js';

// ── Module-level state ──────────────────────────────────────────────────────
const activeSessions = new Map(); // session_id → session object
const supportAnalytics = {
  total_chats_today: 0,
  resolved_by_agent: 0,
  escalated: 0,
  intent_counts: {},
  sentiment_counts: { FRUSTRATED: 0, NEUTRAL: 0, POSITIVE: 0 },
  avg_turns_to_resolve: [],
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatIST(date = new Date()) {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function formatPaise(paise) {
  const rupees = Number(paise) / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Step 1: UNDERSTAND — Classify intent + extract entities ─────────────────

async function understandQuery(userId, message, conversationHistory, apiKey) {
  console.log('[Support Agent] Step 1 — UNDERSTAND: Classifying user intent...');

  // Build recent context from last 3 turns
  const recentTurns = (conversationHistory || []).slice(-3).map(t =>
    `User: ${t.user_message}\nAgent: ${t.agent_response}`
  ).join('\n');

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: 'You are an intent classifier for a PPI wallet customer support system in India. Classify user messages into intent categories and extract key entities. Always respond with valid JSON only.',
      messages: [{
        role: 'user',
        content: `Classify this customer support message.

User message: "${message}"
User ID: ${userId}
${recentTurns ? `Recent conversation:\n${recentTurns}` : ''}

Respond with ONLY valid JSON:
{
  "primary_intent": "PAYMENT_BLOCKED|TRANSACTION_INQUIRY|BALANCE_QUERY|SUB_WALLET_QUERY|KYC_STATUS|KYC_UPGRADE_HELP|MERCHANT_ELIGIBILITY|REWARD_QUERY|CASHBACK_QUERY|SCRATCH_CARD_QUERY|ESCALATION_REQUEST|GENERAL_HELP|OUT_OF_SCOPE",
  "confidence": 0.0-1.0,
  "entities": {
    "amount": null,
    "merchant": null,
    "merchant_category": null,
    "sub_wallet_type": null,
    "transaction_id": null,
    "time_period_days": null
  },
  "requires_tools": ["tool_name1", "tool_name2"],
  "urgency": "HIGH|MEDIUM|LOW",
  "sentiment": "FRUSTRATED|NEUTRAL|POSITIVE",
  "clarification_needed": false,
  "clarification_question": null
}`,
      }],
    });

    const text = response.content[0].text.trim();
    // Extract JSON from response (handle markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Claude response');
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.log(`[Support Agent]   Claude API fallback — using keyword matcher: ${err.message}`);
    return keywordIntentMatch(message);
  }
}

function keywordIntentMatch(message) {
  const lower = message.toLowerCase();
  let primary_intent = 'GENERAL_HELP';
  let urgency = 'LOW';
  let sentiment = 'NEUTRAL';
  const entities = {
    amount: null,
    merchant: null,
    merchant_category: null,
    sub_wallet_type: null,
    transaction_id: null,
    time_period_days: null,
  };

  // Intent matching
  if (/balance|how much|kitna|paisa|paise/.test(lower)) {
    primary_intent = 'BALANCE_QUERY';
  } else if (/blocked|failed|declined|not working|reject/.test(lower)) {
    primary_intent = 'PAYMENT_BLOCKED';
    urgency = 'HIGH';
    sentiment = 'FRUSTRATED';
  } else if (/transaction|payment|transfer|when|history/.test(lower)) {
    primary_intent = 'TRANSACTION_INQUIRY';
  } else if (/kyc|verify|upgrade|expired/.test(lower)) {
    primary_intent = 'KYC_STATUS';
  } else if (/food|transit|fastag|gift|fuel|sub-wallet|sub wallet|ncmc/.test(lower)) {
    primary_intent = 'SUB_WALLET_QUERY';
  } else if (/merchant|eligible|can i pay|where/.test(lower)) {
    primary_intent = 'MERCHANT_ELIGIBILITY';
  } else if (/reward|cashback|scratch/.test(lower)) {
    primary_intent = 'REWARD_QUERY';
  } else if (/human|agent|manager|escalat|complaint/.test(lower)) {
    primary_intent = 'ESCALATION_REQUEST';
    urgency = 'HIGH';
    sentiment = 'FRUSTRATED';
  }

  // Extract sub-wallet type entity
  if (/food/.test(lower)) entities.sub_wallet_type = 'FOOD';
  if (/transit|ncmc|metro/.test(lower)) entities.sub_wallet_type = 'NCMC';
  if (/fastag|toll/.test(lower)) entities.sub_wallet_type = 'FASTAG';
  if (/gift/.test(lower)) entities.sub_wallet_type = 'GIFT';
  if (/fuel|petrol|diesel/.test(lower)) entities.sub_wallet_type = 'FUEL';

  // Extract amount entity
  const amountMatch = lower.match(/(?:₹|rs\.?|inr)\s*(\d[\d,]*(?:\.\d{1,2})?)/);
  if (amountMatch) {
    entities.amount = Math.round(parseFloat(amountMatch[1].replace(/,/g, '')) * 100);
  }

  // Extract time period
  const daysMatch = lower.match(/(\d+)\s*days?/);
  if (daysMatch) entities.time_period_days = parseInt(daysMatch[1], 10);

  return {
    primary_intent,
    confidence: 0.6,
    entities,
    requires_tools: [],
    urgency,
    sentiment,
    clarification_needed: false,
    clarification_question: null,
  };
}

// ── Step 2: INVESTIGATE — Dynamically call tools based on intent ────────────

function investigate(userId, intentResult, context = null) {
  console.log(`[Support Agent] Step 2 — INVESTIGATE: Gathering data for ${intentResult.primary_intent}...`);
  if (context) {
    console.log(`[Support Agent]   Using client-provided context (balance: ${context.balance_paise}, txns: ${(context.recent_transactions || []).length})`);
  }

  const toolResults = {};
  const toolsUsed = [];

  // Helper: use context balance if available, otherwise fall back to mock-data
  function getBalance(opts) {
    if (context && context.balance_paise) {
      toolsUsed.push('clientContext:balance');
      return { balance_paise: context.balance_paise };
    }
    toolsUsed.push('getWalletBalance');
    return getWalletBalance(userId, opts);
  }

  // Helper: use context transactions if available, otherwise fall back to mock-data
  function getTransactions(days, opts) {
    if (context && context.recent_transactions && context.recent_transactions.length > 0) {
      toolsUsed.push('clientContext:transactions');
      return {
        total_matching: context.recent_transactions.length,
        transactions: context.recent_transactions.map(t => ({
          txn_id: t.created_at,
          type: t.transaction_type,
          entry_type: t.entry_type,
          amount: t.amount_formatted || formatPaise(t.amount_paise),
          amount_paise: t.amount_paise,
          status: 'COMPLETED',
          timestamp: t.created_at,
          description: t.description,
        })),
      };
    }
    toolsUsed.push('getTransactionHistory');
    return getTransactionHistory(userId, days, opts);
  }

  try {
    switch (intentResult.primary_intent) {
      case 'BALANCE_QUERY': {
        toolResults.balance = getBalance({ include_runway: true });
        toolResults.sub_wallets = getSubWalletData(userId);
        toolsUsed.push('getSubWalletData');
        break;
      }

      case 'PAYMENT_BLOCKED': {
        toolResults.transactions = getTransactions(7);
        toolResults.balance = getBalance();
        toolResults.sub_wallets = getSubWalletData(userId);
        toolsUsed.push('getSubWalletData');
        try {
          toolResults.blocked_attempts = getBlockedAttempts();
          toolsUsed.push('getBlockedAttempts');
        } catch (e) {
          console.log(`[Support Agent]   getBlockedAttempts failed: ${e.message}`);
          toolResults.blocked_attempts = [];
        }
        break;
      }

      case 'TRANSACTION_INQUIRY': {
        const days = intentResult.entities.time_period_days || 30;
        toolResults.transactions = getTransactions(days);
        if (intentResult.entities.transaction_id) {
          toolResults.search = searchTransactions(userId, { query: intentResult.entities.transaction_id });
          toolsUsed.push('searchTransactions');
        }
        if (intentResult.entities.amount) {
          toolResults.amount_search = searchTransactions(userId, {
            min_amount: intentResult.entities.amount - 100,
            max_amount: intentResult.entities.amount + 100,
          });
          toolsUsed.push('searchTransactions');
        }
        break;
      }

      case 'SUB_WALLET_QUERY': {
        toolResults.sub_wallets = getSubWalletData(userId);
        toolsUsed.push('getSubWalletData');
        toolResults.balance = getBalance();
        break;
      }

      case 'KYC_STATUS':
      case 'KYC_UPGRADE_HELP': {
        toolResults.profile = getUserProfile(userId, { include_limits: true });
        toolsUsed.push('getUserProfile');
        toolResults.balance = getBalance();
        toolsUsed.push('getWalletBalance');
        try {
          toolResults.escalations = getEscalations({ status: 'OPEN' }).filter(e => e.user_id === userId);
          toolsUsed.push('getEscalations');
        } catch (e) {
          toolResults.escalations = [];
        }
        break;
      }

      case 'MERCHANT_ELIGIBILITY': {
        toolResults.sub_wallets = getSubWalletData(userId);
        toolsUsed.push('getSubWalletData');
        toolResults.balance = getBalance();
        break;
      }

      case 'REWARD_QUERY':
      case 'CASHBACK_QUERY':
      case 'SCRATCH_CARD_QUERY': {
        toolResults.balance = getBalance();
        toolResults.transactions = getTransactions(30, { entry_type: 'credit' });
        try {
          toolResults.notifications = getNotifications(userId);
          toolsUsed.push('getNotifications');
        } catch (e) {
          toolResults.notifications = null;
        }
        break;
      }

      case 'ESCALATION_REQUEST': {
        toolResults.balance = getBalance();
        toolResults.transactions = getTransactions(7);
        toolResults.profile = getUserProfile(userId);
        toolsUsed.push('getUserProfile');
        break;
      }

      case 'GENERAL_HELP': {
        toolResults.balance = getBalance();
        toolResults.profile = getUserProfile(userId);
        toolsUsed.push('getUserProfile');
        break;
      }

      case 'OUT_OF_SCOPE':
        // No tools needed
        break;
    }
  } catch (err) {
    console.log(`[Support Agent]   Investigation error: ${err.message}`);
  }

  // Root cause analysis
  let rootCause = null;
  let canResolve = true;
  let resolutionType = 'EXPLAIN';

  switch (intentResult.primary_intent) {
    case 'PAYMENT_BLOCKED': {
      const blocked = toolResults.blocked_attempts || [];
      const userBlocked = blocked.filter(b => b.user_id === userId);
      if (userBlocked.length > 0) {
        const lastBlock = userBlocked[userBlocked.length - 1];
        rootCause = lastBlock.rule || 'LOAD_GUARD';
      } else if (toolResults.balance && Number(toolResults.balance.balance_paise) < (intentResult.entities.amount || 0)) {
        rootCause = 'INSUFFICIENT_BALANCE';
      } else {
        rootCause = 'UNKNOWN';
        canResolve = false;
      }
      break;
    }

    case 'TRANSACTION_INQUIRY': {
      if (toolResults.search && toolResults.search.total_matching > 0) {
        rootCause = 'TRANSACTION_FOUND';
      } else if (toolResults.amount_search && toolResults.amount_search.total_matching > 0) {
        rootCause = 'TRANSACTION_FOUND_BY_AMOUNT';
      } else if (intentResult.entities.transaction_id || intentResult.entities.amount) {
        rootCause = 'TRANSACTION_NOT_FOUND';
      } else {
        rootCause = 'HISTORY_AVAILABLE';
      }
      break;
    }

    case 'BALANCE_QUERY':
      rootCause = 'BALANCE_AVAILABLE';
      break;

    case 'KYC_STATUS':
    case 'KYC_UPGRADE_HELP': {
      if (toolResults.profile) {
        rootCause = `KYC_STATE_${toolResults.profile.kyc?.state || toolResults.profile.kyc_state || 'UNKNOWN'}`;
      } else {
        rootCause = 'PROFILE_NOT_FOUND';
        canResolve = false;
      }
      break;
    }

    case 'SUB_WALLET_QUERY':
      rootCause = 'SUB_WALLET_DATA_AVAILABLE';
      break;

    case 'MERCHANT_ELIGIBILITY':
      rootCause = 'ELIGIBILITY_CHECK';
      break;

    case 'REWARD_QUERY':
    case 'CASHBACK_QUERY':
    case 'SCRATCH_CARD_QUERY':
      rootCause = 'REWARDS_DATA_AVAILABLE';
      break;

    case 'ESCALATION_REQUEST':
      canResolve = false;
      resolutionType = 'ESCALATE';
      rootCause = 'USER_REQUESTED_ESCALATION';
      break;

    case 'OUT_OF_SCOPE':
      rootCause = 'OUT_OF_SCOPE';
      resolutionType = 'REDIRECT';
      break;

    case 'GENERAL_HELP':
      rootCause = 'GENERAL_INQUIRY';
      break;
  }

  return {
    intent: intentResult.primary_intent,
    tools_used: [...new Set(toolsUsed)],
    data_fetched: toolResults,
    root_cause: rootCause,
    can_resolve: canResolve,
    resolution_type: resolutionType,
    context_for_response: toolResults,
  };
}

// ── Step 3: RESOLVE — Build resolution object ───────────────────────────────

function resolve(userId, intent, investigationResult, context = null) {
  console.log(`[Support Agent] Step 3 — RESOLVE: Building resolution for ${intent}...`);

  const data = investigationResult.data_fetched;
  let resolved = investigationResult.can_resolve;
  const resolutionData = {};
  let suggestedActions = [];

  switch (intent) {
    case 'BALANCE_QUERY': {
      const balance = data.balance;
      const subWallets = data.sub_wallets || [];
      resolutionData.main_balance = (context && context.balance_formatted) ? context.balance_formatted : (balance ? formatPaise(balance.balance_paise) : 'N/A');
      resolutionData.main_balance_paise = (context && context.balance_paise) ? context.balance_paise : (balance ? balance.balance_paise : '0');
      resolutionData.sub_wallets = subWallets.map(sw => ({
        type: sw.type,
        label: sw.label,
        balance: formatPaise(sw.balance_paise),
      }));
      const subTotal = subWallets.reduce((sum, sw) => sum + Number(sw.balance_paise || 0), 0);
      resolutionData.sub_wallet_total = formatPaise(subTotal);
      resolutionData.grand_total = formatPaise(Number(balance?.balance_paise || 0) + subTotal);
      suggestedActions = ['Add money', 'View sub-wallets', 'Transaction history'];
      break;
    }

    case 'PAYMENT_BLOCKED': {
      resolutionData.root_cause = investigationResult.root_cause;
      resolutionData.balance = (context && context.balance_formatted) ? context.balance_formatted : (data.balance ? formatPaise(data.balance.balance_paise) : 'N/A');
      if (investigationResult.root_cause === 'INSUFFICIENT_BALANCE') {
        resolutionData.explanation = 'Your wallet balance is insufficient for this payment.';
      } else if (investigationResult.root_cause === 'LOAD_GUARD') {
        resolutionData.explanation = 'This transaction was blocked by our safety rules (RBI load guard).';
      } else {
        resolutionData.explanation = 'We could not determine the exact cause. Escalating for review.';
        resolved = false;
      }
      suggestedActions = ['Retry payment', 'Check balance', 'Talk to support'];
      break;
    }

    case 'KYC_STATUS':
    case 'KYC_UPGRADE_HELP': {
      const profile = data.profile;
      if (profile) {
        resolutionData.kyc_state = profile.kyc?.state || profile.kyc_state || 'UNKNOWN';
        resolutionData.kyc_tier = profile.kyc?.tier || profile.kyc_tier || 'UNKNOWN';
        resolutionData.wallet_expiry = profile.kyc?.wallet_expiry_date || profile.wallet_expiry_date || null;
        resolutionData.name = profile.name;
        resolutionData.balance = (context && context.balance_formatted) ? context.balance_formatted : (data.balance ? formatPaise(data.balance.balance_paise) : 'N/A');
        resolutionData.open_escalations = (data.escalations || []).length;
      }
      suggestedActions = ['Upgrade KYC now', 'View KYC details', 'Talk to support'];
      break;
    }

    case 'TRANSACTION_INQUIRY': {
      const txns = data.transactions;
      resolutionData.total_transactions = txns ? txns.total_matching : 0;
      resolutionData.transactions = txns ? txns.transactions.slice(0, 5).map(t => ({
        id: t.txn_id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        date: t.timestamp,
        description: t.description,
      })) : [];
      if (data.search) {
        resolutionData.search_results = data.search.total_matching;
      }
      if (data.amount_search) {
        resolutionData.amount_search_results = data.amount_search.total_matching;
      }
      suggestedActions = ['View all transactions', 'Search by amount', 'Raise dispute'];
      break;
    }

    case 'SUB_WALLET_QUERY': {
      const subWallets = data.sub_wallets || [];
      resolutionData.sub_wallets = subWallets.map(sw => ({
        type: sw.type,
        label: sw.label,
        balance: formatPaise(sw.balance_paise),
        status: sw.status,
        monthly_limit: sw.monthly_limit_paise ? formatPaise(sw.monthly_limit_paise) : null,
        monthly_loaded: sw.monthly_loaded_paise ? formatPaise(sw.monthly_loaded_paise) : null,
      }));
      resolutionData.count = subWallets.length;
      suggestedActions = ['View all sub-wallets', 'Load sub-wallet', 'Check eligibility'];
      break;
    }

    case 'MERCHANT_ELIGIBILITY': {
      const subWallets = data.sub_wallets || [];
      resolutionData.sub_wallets = subWallets.map(sw => ({
        type: sw.type,
        label: sw.label,
        balance: formatPaise(sw.balance_paise),
        eligible_categories: sw.eligible_categories || [],
      }));
      resolutionData.balance = (context && context.balance_formatted) ? context.balance_formatted : (data.balance ? formatPaise(data.balance.balance_paise) : 'N/A');
      suggestedActions = ['View sub-wallets', 'Check balance', 'Pay merchant'];
      break;
    }

    case 'REWARD_QUERY':
    case 'CASHBACK_QUERY':
    case 'SCRATCH_CARD_QUERY': {
      resolutionData.balance = (context && context.balance_formatted) ? context.balance_formatted : (data.balance ? formatPaise(data.balance.balance_paise) : 'N/A');
      const creditTxns = data.transactions ? data.transactions.transactions.filter(t =>
        t.type === 'REFUND' || t.type === 'CASHBACK' || t.entry_type === 'CREDIT'
      ) : [];
      resolutionData.recent_credits = creditTxns.slice(0, 5).map(t => ({
        type: t.type,
        amount: t.amount,
        date: t.timestamp,
      }));
      resolutionData.notifications = data.notifications ? data.notifications.notifications || [] : [];
      suggestedActions = ['View rewards', 'Check scratch cards', 'Transaction history'];
      break;
    }

    case 'ESCALATION_REQUEST': {
      resolved = false;
      resolutionData.needs_escalation = true;
      suggestedActions = ['Call helpline', 'Email support'];
      break;
    }

    case 'OUT_OF_SCOPE': {
      resolutionData.message = 'This query is outside the scope of wallet support. I can help with balance, transactions, KYC, sub-wallets, and payments.';
      suggestedActions = ['Check balance', 'View transactions', 'KYC status'];
      break;
    }

    case 'GENERAL_HELP':
    default: {
      resolutionData.balance = (context && context.balance_formatted) ? context.balance_formatted : (data.balance ? formatPaise(data.balance.balance_paise) : 'N/A');
      resolutionData.name = (context && context.user_name) ? context.user_name : (data.profile ? data.profile.name : null);
      suggestedActions = ['Check balance', 'View transactions', 'KYC status'];
      break;
    }
  }

  return {
    resolved,
    resolution_data: resolutionData,
    suggested_actions: suggestedActions,
  };
}

// ── Step 4: RESPOND — Draft natural language response ───────────────────────

async function draftResponse(userId, intent, resolution, sentiment, apiKey) {
  console.log(`[Support Agent] Step 4 — RESPOND: Drafting response (sentiment: ${sentiment})...`);

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'You are a friendly, precise customer support agent for a PPI wallet app in India. You have just investigated the user\'s issue using live wallet data. Rules: Be direct and specific with real ₹ amounts. Match tone to sentiment (FRUSTRATED=extra empathetic, NEUTRAL=professional, POSITIVE=warm). Always end with one clear next step. Max 4 sentences for simple queries, 6 for complex. Never use RBI jargon.',
      messages: [{
        role: 'user',
        content: `Draft a customer support response.
Sentiment: ${sentiment}
Intent: ${intent}
Resolution type: ${resolution.resolved ? 'RESOLVED' : 'ESCALATED'}
Root cause: ${resolution.resolution_data.root_cause || 'N/A'}
Data: ${JSON.stringify(resolution.resolution_data)}
Can resolve: ${resolution.resolved}
${resolution.ticket_id ? `Ticket ID: ${resolution.ticket_id}` : ''}

Write a helpful, concise response.`,
      }],
    });

    return {
      response_text: response.content[0].text.trim(),
      suggested_actions: resolution.suggested_actions,
    };
  } catch (err) {
    console.log(`[Support Agent]   Claude API fallback — using template response: ${err.message}`);
    return templateResponse(intent, resolution);
  }
}

function templateResponse(intent, resolution) {
  const data = resolution.resolution_data;
  let text = '';

  switch (intent) {
    case 'BALANCE_QUERY':
      text = `Your main wallet balance is ${data.main_balance}. You also have ${(data.sub_wallets || []).length} sub-wallet(s) totaling ${data.sub_wallet_total}. Your combined balance is ${data.grand_total}.`;
      break;
    case 'PAYMENT_BLOCKED':
      text = `Your payment was blocked because: ${data.explanation} Your current balance is ${data.balance}. Please try again after resolving the issue.`;
      break;
    case 'KYC_STATUS':
    case 'KYC_UPGRADE_HELP':
      text = `Your KYC status is ${data.kyc_state} (${data.kyc_tier}).${data.wallet_expiry ? ` Wallet expires on ${data.wallet_expiry}.` : ''} Your balance is ${data.balance}.`;
      break;
    case 'TRANSACTION_INQUIRY':
      text = `Found ${data.total_transactions} transaction(s) in the requested period.${data.transactions && data.transactions.length > 0 ? ` Most recent: ${data.transactions[0].type} of ${data.transactions[0].amount}.` : ''}`;
      break;
    case 'SUB_WALLET_QUERY':
      text = `You have ${data.count} sub-wallet(s): ${(data.sub_wallets || []).map(sw => `${sw.label} (${sw.balance})`).join(', ')}.`;
      break;
    case 'MERCHANT_ELIGIBILITY':
      text = `Your main wallet balance is ${data.balance}. You have ${(data.sub_wallets || []).length} sub-wallet(s) that can be used at eligible merchants.`;
      break;
    case 'REWARD_QUERY':
    case 'CASHBACK_QUERY':
    case 'SCRATCH_CARD_QUERY':
      text = `Your current balance is ${data.balance}.${data.recent_credits && data.recent_credits.length > 0 ? ` You received ${data.recent_credits.length} credit(s) recently.` : ' No recent credits found.'}`;
      break;
    case 'ESCALATION_REQUEST':
      text = 'I understand your concern. Let me connect you with our support team right away.';
      break;
    case 'OUT_OF_SCOPE':
      text = data.message;
      break;
    case 'GENERAL_HELP':
    default:
      text = `${data.name ? `Hi ${data.name}! ` : ''}Your wallet balance is ${data.balance}. I can help you with balance inquiries, transactions, KYC, sub-wallets, and payments.`;
      break;
  }

  return {
    response_text: text,
    suggested_actions: resolution.suggested_actions,
  };
}

// ── Step 5: ESCALATE — Full escalation with ticket + ops + helpline ─────────

async function triggerFullEscalation(userId, conversationHistory, investigationResult, apiKey) {
  console.log('[Support Agent] Step 5 — ESCALATE: Triggering full escalation...');

  const profile = investigationResult.data_fetched.profile || getUserProfile(userId) || {};
  const balance = investigationResult.data_fetched.balance;

  // A. Escalate to ops
  let escalation;
  try {
    escalation = escalateToOps(userId, {
      name: profile.name || userId,
      phone: profile.phone || null,
      priority: 'P2_HIGH',
      days_until_expiry: null,
      total_at_risk: balance ? formatPaise(balance.balance_paise) : '₹0.00',
      escalation_reason: investigationResult.root_cause || 'Customer support escalation',
      outreach_attempts: (conversationHistory || []).length,
      agent_reasoning: `Support agent could not resolve: ${investigationResult.intent}. Root cause: ${investigationResult.root_cause}.`,
      recommended_action: 'Manual review and outreach required',
      source: 'SUPPORT_AGENT',
    });
  } catch (err) {
    console.log(`[Support Agent]   Escalation failed: ${err.message}`);
    escalation = { escalation_id: `ESC-FALLBACK-${Date.now()}` };
  }

  // B. Create support ticket
  let ticket;
  try {
    ticket = createTicket(userId, {
      name: profile.name || userId,
      phone: profile.phone || null,
      issue_type: investigationResult.intent,
      issue_summary: `Auto-escalated from support chat. Root cause: ${investigationResult.root_cause || 'UNKNOWN'}.`,
      conversation_history: (conversationHistory || []).map(t => ({
        user: t.user_message,
        agent: t.agent_response,
        intent: t.intent,
      })),
      investigation_data: {
        tools_used: investigationResult.tools_used,
        root_cause: investigationResult.root_cause,
      },
      root_cause: investigationResult.root_cause || 'UNKNOWN',
      priority: 'HIGH',
    });
  } catch (err) {
    console.log(`[Support Agent]   Ticket creation failed: ${err.message}`);
    ticket = { ticket_id: `TKT-FALLBACK-${Date.now()}` };
  }

  // C. Helpline info
  const helplineInfo = {
    number: '1800-XXX-XXXX',
    hours: '9 AM - 9 PM IST',
    whatsapp: 'wa.me/91XXXXXXXXXX',
    expected_resolution: 'Within 2 hours',
  };

  // D. Send in-app notification (best-effort)
  try {
    getNotificationsByUser(userId);
    console.log(`[Support Agent]   Ticket ${ticket.ticket_id} created, notification sent.`);
  } catch (e) {
    // Non-critical
  }

  return {
    ticket_id: ticket.ticket_id,
    escalation_id: escalation.escalation_id,
    helpline_info: helplineInfo,
  };
}

// ── Session management ──────────────────────────────────────────────────────

function getOrCreateSession(userId, sessionId) {
  const id = sessionId || `SESS-${Date.now()}-${userId}`;

  if (activeSessions.has(id)) {
    const session = activeSessions.get(id);
    // Expire after 30 min inactivity
    const lastActivity = session.turns.length > 0
      ? new Date(session.turns[session.turns.length - 1].timestamp)
      : new Date(session.created_at);
    const minutesSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60);
    if (minutesSinceActivity > 30) {
      console.log(`[Support Agent]   Session ${id} expired (${Math.round(minutesSinceActivity)} min inactive). Creating new.`);
      activeSessions.delete(id);
    } else {
      session.last_activity = formatIST();
      return session;
    }
  }

  const session = {
    session_id: id,
    user_id: userId,
    turns: [],
    created_at: formatIST(),
    last_activity: formatIST(),
    escalation_triggered: false,
    ticket_id: null,
  };
  activeSessions.set(id, session);
  return session;
}

function addTurn(session, message, intent, toolsUsed, response, resolved) {
  const turn = {
    turn_number: session.turns.length + 1,
    timestamp: formatIST(),
    user_message: message,
    intent,
    tools_used: toolsUsed,
    agent_response: response,
    resolved,
  };
  session.turns.push(turn);
  session.last_activity = formatIST();
  return turn;
}

function countUnresolvedSameIntent(session, intent) {
  return session.turns.filter(t => t.intent === intent && !t.resolved).length;
}

function getSession(sessionId) {
  return activeSessions.get(sessionId) || null;
}

// ── Analytics ───────────────────────────────────────────────────────────────

function updateAnalytics(intentResult, resolved, escalated) {
  supportAnalytics.total_chats_today++;
  supportAnalytics.intent_counts[intentResult.primary_intent] =
    (supportAnalytics.intent_counts[intentResult.primary_intent] || 0) + 1;
  supportAnalytics.sentiment_counts[intentResult.sentiment] =
    (supportAnalytics.sentiment_counts[intentResult.sentiment] || 0);
  supportAnalytics.sentiment_counts[intentResult.sentiment]++;
  if (resolved) supportAnalytics.resolved_by_agent++;
  if (escalated) supportAnalytics.escalated++;
}

function getSupportAnalytics() {
  const avgTurns = supportAnalytics.avg_turns_to_resolve.length > 0
    ? supportAnalytics.avg_turns_to_resolve.reduce((a, b) => a + b, 0) / supportAnalytics.avg_turns_to_resolve.length
    : 0;

  return {
    ...supportAnalytics,
    avg_turns_to_resolve: Math.round(avgTurns * 10) / 10,
    resolution_rate: supportAnalytics.total_chats_today > 0
      ? Math.round((supportAnalytics.resolved_by_agent / supportAnalytics.total_chats_today) * 100)
      : 0,
  };
}

function resetAnalytics() {
  supportAnalytics.total_chats_today = 0;
  supportAnalytics.resolved_by_agent = 0;
  supportAnalytics.escalated = 0;
  supportAnalytics.intent_counts = {};
  supportAnalytics.sentiment_counts = { FRUSTRATED: 0, NEUTRAL: 0, POSITIVE: 0 };
  supportAnalytics.avg_turns_to_resolve = [];
}

// ── Main orchestrator ───────────────────────────────────────────────────────

export async function handleSupportChat(userId, message, sessionId, apiKey, context = null) {
  const startTime = Date.now();
  console.log(`\n[Support Agent] ═══ New chat from ${userId} ═══`);

  // Get or create session
  let session = getOrCreateSession(userId, sessionId);

  // Step 1: UNDERSTAND
  const intentResult = await understandQuery(userId, message, session.turns, apiKey);
  console.log(`[Support Agent]   Intent: ${intentResult.primary_intent} (confidence: ${intentResult.confidence})`);

  // If clarification needed, return early
  if (intentResult.clarification_needed) {
    addTurn(session, message, intentResult.primary_intent, [], intentResult.clarification_question, false);
    return {
      session_id: session.session_id,
      response_text: intentResult.clarification_question,
      suggested_actions: [],
      tools_used: [],
      intent_detected: intentResult.primary_intent,
      confidence: intentResult.confidence,
      urgency: intentResult.urgency,
      sentiment: intentResult.sentiment,
      resolved: false,
      ticket_id: null,
      escalated: false,
      helpline_info: null,
      response_time_ms: Date.now() - startTime,
    };
  }

  // Step 2: INVESTIGATE
  const investigation = investigate(userId, intentResult, context);

  // Step 3: RESOLVE
  const resolution = resolve(userId, intentResult.primary_intent, investigation, context);

  // Step 4: RESPOND
  let responseResult;
  let escalationResult = null;

  // Check if escalation needed
  const needsEscalation = !resolution.resolved ||
    intentResult.primary_intent === 'ESCALATION_REQUEST' ||
    countUnresolvedSameIntent(session, intentResult.primary_intent) >= 2;

  if (needsEscalation) {
    // Step 5: ESCALATE
    escalationResult = await triggerFullEscalation(userId, session.turns, investigation, apiKey);
    session.escalation_triggered = true;
    session.ticket_id = escalationResult.ticket_id;

    responseResult = await draftResponse(userId, intentResult.primary_intent,
      { ...resolution, resolved: false, ticket_id: escalationResult.ticket_id },
      intentResult.sentiment, apiKey);

    // Append helpline info to response
    responseResult.response_text += `\n\n🎫 Ticket #${escalationResult.ticket_id} raised.\n📞 Helpline: ${escalationResult.helpline_info.number} (${escalationResult.helpline_info.hours})\n⏱️ Expected resolution: ${escalationResult.helpline_info.expected_resolution}`;
  } else {
    responseResult = await draftResponse(userId, intentResult.primary_intent,
      resolution, intentResult.sentiment, apiKey);
  }

  // Add turn to session
  addTurn(session, message, intentResult.primary_intent, investigation.tools_used, responseResult.response_text, resolution.resolved);

  // Update analytics
  updateAnalytics(intentResult, resolution.resolved, needsEscalation);

  // Track turns to resolve
  if (resolution.resolved) {
    supportAnalytics.avg_turns_to_resolve.push(session.turns.length);
  }

  return {
    session_id: session.session_id,
    response_text: responseResult.response_text,
    suggested_actions: responseResult.suggested_actions || resolution.suggested_actions || [],
    tools_used: investigation.tools_used,
    intent_detected: intentResult.primary_intent,
    confidence: intentResult.confidence,
    urgency: intentResult.urgency,
    sentiment: intentResult.sentiment,
    resolved: resolution.resolved && !needsEscalation,
    ticket_id: escalationResult?.ticket_id || null,
    escalated: needsEscalation,
    helpline_info: escalationResult?.helpline_info || null,
    response_time_ms: Date.now() - startTime,
  };
}

// ── Exports ─────────────────────────────────────────────────────────────────

export {
  understandQuery,
  investigate,
  resolve,
  draftResponse,
  triggerFullEscalation,
  getSession,
  getSupportAnalytics,
  resetAnalytics,
};
