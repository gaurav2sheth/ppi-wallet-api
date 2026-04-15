import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { handleChat } from './mcp/chat-handler.js';
import { runKycAlerts, previewAtRiskUsers } from './mcp/services/kyc-alert-service.js';
import { validateLoadAmount, getBlockedAttempts } from './mcp/services/wallet-load-guard.js';
import { getSubWallets, loadSubWallet, spendFromSubWallet, validateMerchantEligibility, getBenefitsUtilisationSummary } from './mcp/services/sub-wallet-service.js';
import { runKycUpgradeAgent, getAgentRunHistory, getActiveNotifications, getNotificationsByUser, markNotificationRead, markNotificationActionTaken } from './mcp/agents/kyc-upgrade-agent.js';
import { getEscalations, resolveEscalation, updateEscalationStatus, getEscalationStats } from './mcp/agents/escalation-manager.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://gaurav2sheth.github.io',
    'http://localhost:5173',
    'http://localhost:5174',
  ],
  methods: ['GET', 'POST', 'PATCH'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, tools: 18, version: '1.0.0' });
});

// ── POST /api/chat ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured.' });
    }

    const role = req.query.role === 'admin' ? 'admin' : 'user';
    const reply = await handleChat(message, apiKey, role);
    res.json({ reply });
  } catch (err) {
    console.error('[Chat] Error:', err?.message || err);
    res.status(502).json({ error: `Chat error: ${err?.message || 'Unknown error'}` });
  }
});

// ── POST /api/summarise-transactions ─────────────────────────────────────────
app.post('/api/summarise-transactions', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions provided' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured.' });
    }

    const role = req.query.role === 'admin' ? 'admin' : 'user';

    const formatted = transactions.map((t, i) => {
      const dateField = t.created_at || t.createdAt;
      const date = new Date(dateField).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const amountField = t.amount_paise || t.amountPaise;
      const amount = '₹' + (Number(amountField) / 100).toLocaleString('en-IN');
      const type = t.entry_type || t.sagaType || 'unknown';
      const desc = t.description || 'N/A';
      const status = t.status ? ` | Status: ${t.status}` : '';
      const error = t.error ? ` | Error: ${t.error}` : '';
      return `${i + 1}. [${date}] ${type} | ${amount} | ${desc}${status}${error}`;
    }).join('\n');

    const systemPrompt = role === 'admin'
      ? 'You are a financial analyst for a PPI wallet product in India. Be concise, factual, and use INR currency formatting.'
      : 'You are a personal finance assistant for a PPI wallet user in India. Be concise, friendly, and use INR currency formatting. Address the user directly.';

    const userPrompt = role === 'admin'
      ? `Here is a list of wallet transactions. Provide a 3-5 line plain English summary covering: total count, total value, largest transaction, any notable patterns.\n\nTransactions:\n${formatted}`
      : `Here are my recent wallet transactions. Give me a 3-5 line plain English summary covering: total count, total spending vs income, largest transaction, and any tips or patterns you notice.\n\nTransactions:\n${formatted}`;

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    const summary = textBlock ? textBlock.text : 'No summary generated.';
    res.json({ summary });
  } catch (err) {
    console.error('[Summarise] Error:', err?.message || err);
    res.status(502).json({ error: `Claude API error: ${err?.message || 'Unknown error'}` });
  }
});

// ── GET /api/kyc-alerts/preview ──────────────────────────────────────────────
app.get('/api/kyc-alerts/preview', (_req, res) => {
  try {
    const preview = previewAtRiskUsers();
    res.json(preview);
  } catch (err) {
    console.error('[KYC Alert Preview] Error:', err?.message || err);
    res.status(500).json({ error: `Preview error: ${err?.message || 'Unknown error'}` });
  }
});

// ── POST /api/kyc-alerts/run ────────────────────────────────────────────────
app.post('/api/kyc-alerts/run', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured.' });
    }

    const result = await runKycAlerts(apiKey);
    res.json(result);
  } catch (err) {
    console.error('[KYC Alert Run] Error:', err?.message || err);
    res.status(502).json({ error: `KYC Alert error: ${err?.message || 'Unknown error'}` });
  }
});

// ── POST /api/wallet/validate-load ──────────────────────────────────────────
app.post('/api/wallet/validate-load', async (req, res) => {
  try {
    const { user_id, amount } = req.body;

    if (!user_id || typeof user_id !== 'string') {
      return res.status(400).json({ error: 'Invalid user_id' });
    }

    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum < 1 || amountNum > 100000) {
      return res.status(400).json({ error: 'Invalid amount', message: 'Amount must be between ₹1 and ₹1,00,000' });
    }

    const amountPaise = Math.round(amountNum * 100);
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    const result = await validateLoadAmount(user_id, amountPaise, apiKey || undefined);

    if (result.allowed) {
      res.json({ allowed: true, message: `You can add ₹${amountNum.toLocaleString('en-IN')} to your wallet`, new_balance: result.new_balance });
    } else if (result.error) {
      res.status(404).json(result);
    } else {
      res.json({ allowed: false, blocked_by: result.blocked_by, user_message: result.user_message, suggestion: result.suggestion, max_allowed: result.max_allowed });
    }
  } catch (err) {
    console.error('[Load Guard] Error:', err?.message || err);
    res.status(500).json({ error: `Validation error: ${err?.message || 'Unknown error'}` });
  }
});

// ── GET /api/wallet/load-guard-log ─────────────────────────────────────────
app.get('/api/wallet/load-guard-log', (_req, res) => {
  res.json({ attempts: getBlockedAttempts() });
});

// ── Sub-Wallet Routes ─────────────────────────────────────────────────────────
app.get('/api/wallet/sub-wallets/:userId', (req, res) => {
  const result = getSubWallets(req.params.userId);
  if (!result) return res.status(404).json({ error: 'User not found' });
  res.json(result);
});

app.post('/api/wallet/sub-wallets/load', (req, res) => {
  const { employer_id, user_id, type, amount_paise, occasion } = req.body;
  if (!employer_id || !user_id || !type || !amount_paise) {
    return res.status(400).json({ error: 'employer_id, user_id, type, and amount_paise are required' });
  }
  const result = loadSubWallet(employer_id, user_id, type, amount_paise, occasion);
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/wallet/sub-wallets/spend', (req, res) => {
  const { user_id, type, amount_paise, merchant, merchant_category } = req.body;
  if (!user_id || !type || !amount_paise || !merchant) {
    return res.status(400).json({ error: 'user_id, type, amount_paise, and merchant are required' });
  }
  const result = spendFromSubWallet(user_id, type, amount_paise, merchant, merchant_category || 'Other');
  res.status(result.success ? 200 : 400).json(result);
});

app.get('/api/wallet/sub-wallets/eligibility', (req, res) => {
  const { merchant_category, sub_wallet_type } = req.query;
  if (!merchant_category || !sub_wallet_type) {
    return res.status(400).json({ error: 'merchant_category and sub_wallet_type query params required' });
  }
  res.json(validateMerchantEligibility(String(merchant_category), String(sub_wallet_type)));
});

app.get('/api/wallet/benefits/utilisation', (_req, res) => {
  res.json(getBenefitsUtilisationSummary());
});

// ── KYC Upgrade Agent Routes ────────────────────────────────────────────────

// POST /api/kyc-agent/run — Trigger a KYC upgrade agent run
app.post('/api/kyc-agent/run', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });
    const result = await runKycUpgradeAgent(apiKey);
    res.json(result);
  } catch (err) {
    console.error('KYC Agent run failed:', err);
    res.status(500).json({ error: 'Agent run failed', detail: err.message });
  }
});

// GET /api/kyc-agent/runs — Returns last 10 agent runs
app.get('/api/kyc-agent/runs', (req, res) => {
  const runs = getAgentRunHistory();
  res.json({ runs, total: runs.length });
});

// GET /api/kyc-agent/escalations — Query escalations with optional filters
app.get('/api/kyc-agent/escalations', (req, res) => {
  const { status, priority } = req.query;
  const escalations = getEscalations({ status, priority });
  const stats = getEscalationStats();
  res.json({ escalations, stats });
});

// PATCH /api/kyc-agent/escalations/:escalationId — Resolve or update escalation
app.patch('/api/kyc-agent/escalations/:escalationId', (req, res) => {
  const { escalationId } = req.params;
  const { resolved_by, notes, status } = req.body;
  if (resolved_by && notes) {
    const result = resolveEscalation(escalationId, resolved_by, notes);
    if (!result) return res.status(404).json({ error: 'Escalation not found' });
    return res.json(result);
  }
  if (status) {
    const result = updateEscalationStatus(escalationId, status);
    if (!result) return res.status(404).json({ error: 'Escalation not found' });
    return res.json(result);
  }
  res.status(400).json({ error: 'Provide resolved_by+notes or status' });
});

// GET /api/kyc-agent/notifications/:userId — Get notifications for a user
app.get('/api/kyc-agent/notifications/:userId', (req, res) => {
  const notifications = getNotificationsByUser(req.params.userId);
  res.json({ notifications, total: notifications.length });
});

// PATCH /api/kyc-agent/notifications/:notificationId — Mark notification read/actioned
app.patch('/api/kyc-agent/notifications/:notificationId', (req, res) => {
  const { notificationId } = req.params;
  const { read, action_taken } = req.body;
  let result = null;
  if (read) result = markNotificationRead(notificationId);
  if (action_taken) result = markNotificationActionTaken(notificationId);
  if (!result) return res.status(404).json({ error: 'Notification not found' });
  res.json(result);
});

// GET /api/kyc-agent/audit/:runId — Get full audit trail for a specific run
app.get('/api/kyc-agent/audit/:runId', (req, res) => {
  const runs = getAgentRunHistory();
  const run = runs.find(r => r.run_id === req.params.runId);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json({
    run_id: run.run_id,
    started_at: run.started_at,
    completed_at: run.completed_at,
    audit_trail: run.audit_trail || [],
    decisions: run.decisions || [],
    actions_taken: run.actions_taken || [],
    escalations: run.escalations || [],
  });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PPI Wallet API server running on port ${PORT}`);
});
