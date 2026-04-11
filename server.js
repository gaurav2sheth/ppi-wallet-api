import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { handleChat } from './mcp/chat-handler.js';
import {
  getWalletBalance,
  getTransactionHistory,
  listUsers,
  getUserProfile,
  getSpendingSummary,
  getSystemStats,
  searchUsers,
  getKycStats,
  searchTransactions,
  addMoney,
  payMerchant,
  transferP2P,
  payBill,
} from './mcp/mock-data.js';

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
  res.json({ ok: true, tools: 40, version: '1.0.0' });
});

// ── POST /api/chat ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { message, context } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured.' });
    }

    const role = req.query.role === 'admin' ? 'admin' : 'user';
    const reply = await handleChat(message, apiKey, role, context);
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

// ── GET /api/users — Admin: paginated user list ─────────────────────────────
app.get('/api/users', (req, res) => {
  try {
    const filters = req.query;
    const allUsers = listUsers();

    // Transform MCP users to admin dashboard WalletUser format
    let users = allUsers.map((u, i) => {
      const profile = getUserProfile(u.user_id);
      return {
        id: `wu-${u.user_id}`,
        userId: u.user_id,
        walletId: `wallet-${u.user_id}`,
        name: profile?.name ?? u.user_id,
        phone: profile?.phone ?? '',
        email: null,
        kycTier: u.kyc_tier ?? 'MINIMUM',
        kycState: u.kyc_state ?? 'MIN_KYC',
        walletState: u.status ?? 'ACTIVE',
        balancePaise: profile?.balance_paise ?? '0',
        heldPaise: profile?.held_amount?.replace(/[₹,]/g, '').trim() ? String(Math.round(parseFloat(profile.held_amount.replace(/[₹,]/g, '')) * 100)) : '0',
        availablePaise: profile?.available_balance ? String(Math.round(parseFloat(profile.available_balance.replace(/[₹,]/g, '')) * 100)) : '0',
        isActive: u.status === 'ACTIVE',
        walletExpiryDate: profile?.kyc?.wallet_expiry_date ?? null,
        lastActivityAt: profile?.last_activity ?? null,
        createdAt: profile?.created_at ?? new Date().toISOString(),
        updatedAt: profile?.last_activity ?? new Date().toISOString(),
      };
    });

    // Search filter
    if (filters.search) {
      const q = String(filters.search).toLowerCase();
      users = users.filter(u => u.name.toLowerCase().includes(q) || u.phone.includes(q) || u.walletId.includes(q) || u.userId.includes(q));
    }
    if (filters.kycTier) users = users.filter(u => u.kycTier === filters.kycTier);
    if (filters.kycState) users = users.filter(u => u.kycState === filters.kycState);
    if (filters.walletState) users = users.filter(u => u.walletState === filters.walletState);

    const page = parseInt(filters.page) || 1;
    const pageSize = parseInt(filters.pageSize) || 20;
    const total = users.length;
    const start = (page - 1) * pageSize;
    const data = users.slice(start, start + pageSize);

    res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error('[Users] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/users/:userId — Admin: user detail ─────────────────────────────
app.get('/api/users/:userId', (req, res) => {
  try {
    const profile = getUserProfile(req.params.userId);
    if (!profile) return res.status(404).json({ error: 'User not found' });

    const txnHistory = getTransactionHistory(req.params.userId, 90, { limit: 15 });
    const spending = getSpendingSummary(req.params.userId, 30);

    const recentTxns = (txnHistory?.transactions ?? []).map(t => ({
      id: t.txn_id,
      entryType: t.entry_type === 'credit' ? 'CREDIT' : 'DEBIT',
      amountPaise: t.amount_paise,
      balanceAfterPaise: '0',
      transactionType: t.type === 'load' ? 'ADD_MONEY' : t.type === 'pay' ? 'MERCHANT_PAY' : 'P2P_TRANSFER',
      description: t.description,
      createdAt: t.timestamp,
    }));

    const detail = {
      id: `wu-${profile.user_id}`,
      userId: profile.user_id,
      walletId: `wallet-${profile.user_id}`,
      name: profile.name,
      phone: profile.phone,
      email: null,
      kycTier: profile.kyc.tier,
      kycState: profile.kyc.state,
      walletState: profile.status,
      balancePaise: profile.balance_paise,
      heldPaise: String(Math.round(parseFloat(profile.held_amount.replace(/[₹,]/g, '')) * 100)),
      availablePaise: String(Math.round(parseFloat(profile.available_balance.replace(/[₹,]/g, '')) * 100)),
      isActive: profile.status === 'ACTIVE',
      walletExpiryDate: profile.kyc.wallet_expiry_date,
      lastActivityAt: profile.last_activity,
      createdAt: profile.created_at,
      updatedAt: profile.last_activity,
      kycProfile: {
        id: `kyc-${profile.user_id}`,
        state: profile.kyc.state,
        aadhaarVerifiedAt: profile.kyc.aadhaar_verified ? profile.created_at : null,
        panMasked: profile.kyc.pan_masked,
        ckycNumber: profile.kyc.ckyc_number,
        rejectedReason: profile.kyc.rejected_reason,
        createdAt: profile.created_at,
        updatedAt: profile.last_activity,
        auditLogs: [],
      },
      recentTransactions: recentTxns,
      totalTransactions: txnHistory?.total_matching ?? 0,
      totalSpentPaise: spending?.spending ? String(Math.round(parseFloat(spending.spending.total_spent.replace(/[₹,]/g, '')) * 100)) : '0',
      totalReceivedPaise: spending?.income ? String(Math.round(parseFloat(spending.income.total_income.replace(/[₹,]/g, '')) * 100)) : '0',
      totalCashbackPaise: '0',
    };

    res.json(detail);
  } catch (err) {
    console.error('[UserDetail] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/transactions — Admin: paginated transaction list ────────────────
app.get('/api/transactions', (req, res) => {
  try {
    const filters = req.query;
    const allUsers = listUsers();

    // Collect all transactions across all users
    let allTxns = [];
    for (const u of allUsers) {
      const history = getTransactionHistory(u.user_id, 90, { limit: 100 });
      if (!history) continue;
      const profile = getUserProfile(u.user_id);
      for (const t of history.transactions) {
        const sagaMap = { load: 'ADD_MONEY', pay: 'MERCHANT_PAY', transfer: 'P2P_TRANSFER' };
        const statusMap = { success: 'COMPLETED', failed: 'DLQ', pending: 'RUNNING' };
        allTxns.push({
          id: t.txn_id,
          sagaType: sagaMap[t.type] ?? 'MERCHANT_PAY',
          status: statusMap[t.status] ?? 'COMPLETED',
          amountPaise: t.amount_paise,
          walletId: `wallet-${u.user_id}`,
          userName: profile?.name ?? u.user_id,
          userPhone: profile?.phone ?? '',
          counterparty: t.merchant !== 'N/A' ? t.merchant : null,
          description: t.description,
          idempotencyKey: `idem-${t.txn_id}`,
          error: t.status === 'failed' ? 'Transaction failed' : null,
          createdAt: t.timestamp,
          updatedAt: t.timestamp,
          completedAt: t.status === 'success' ? t.timestamp : null,
        });
      }
    }

    // Sort by date descending
    allTxns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Search filter
    if (filters.search) {
      const q = String(filters.search).toLowerCase();
      allTxns = allTxns.filter(t => (t.description || '').toLowerCase().includes(q) || t.walletId.includes(q) || t.userName.toLowerCase().includes(q) || t.id.includes(q));
    }
    if (filters.sagaType) allTxns = allTxns.filter(t => t.sagaType === filters.sagaType);
    if (filters.status) allTxns = allTxns.filter(t => t.status === filters.status);
    if (filters.walletId) allTxns = allTxns.filter(t => t.walletId === filters.walletId);

    const page = parseInt(filters.page) || 1;
    const pageSize = parseInt(filters.pageSize) || 20;
    const total = allTxns.length;
    const start = (page - 1) * pageSize;
    const data = allTxns.slice(start, start + pageSize);

    res.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error('[Transactions] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/overview — Admin: dashboard analytics ──────────────────────────
app.get('/api/overview', (req, res) => {
  try {
    const stats = getSystemStats();
    const kycStats = getKycStats();

    const overview = {
      totalUsers: stats.platform_overview.total_users,
      activeUsers: stats.platform_overview.active_users,
      suspendedUsers: stats.platform_overview.suspended_users,
      dormantUsers: stats.platform_overview.dormant_users,
      totalBalancePaise: String(Math.round(parseFloat(stats.financials.total_aum.replace(/[₹,]/g, '')) * 100)),
      totalTransactions: stats.transaction_volume.last_30d.count,
      totalTransactionVolumePaise: String(Math.round(parseFloat(stats.transaction_volume.last_30d.volume.replace(/[₹,]/g, '')) * 100)),
      kycStats: {
        fullKyc: kycStats.tier_breakdown.FULL,
        minimumKyc: kycStats.tier_breakdown.MINIMUM,
        pendingKyc: kycStats.pending_count,
        rejectedKyc: kycStats.rejected_count,
        completionRate: kycStats.success_rate,
      },
      recentActivity: {
        transactions24h: stats.transaction_volume.last_24h.count,
        volume24h: stats.transaction_volume.last_24h.volume,
        flaggedTransactions: stats.alerts.flagged_transactions,
        failedTransactions: stats.alerts.failed_transactions,
      },
    };

    res.json(overview);
  } catch (err) {
    console.error('[Overview] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/kyc/stats — Admin: KYC statistics ──────────────────────────────
app.get('/api/kyc/stats', (req, res) => {
  try {
    const stats = getKycStats();
    res.json({
      distribution: Object.fromEntries(stats.distribution.map(d => [d.state, d.count])),
      tierBreakdown: stats.tier_breakdown,
      successRate: stats.success_rate,
      failureRate: stats.failure_rate,
      pendingCount: stats.pending_count,
      rejectedCount: stats.rejected_count,
      suspendedCount: stats.suspended_count,
      expiringWallets: stats.expiring_wallets.length,
      avgVerificationMinutes: stats.avg_verification_minutes,
    });
  } catch (err) {
    console.error('[KycStats] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/kyc/queue — Admin: pending KYC queue ───────────────────────────
app.get('/api/kyc/queue', (req, res) => {
  try {
    const stats = getKycStats();
    const queue = stats.pending_queue.map(u => ({
      userId: u.user_id,
      name: u.name,
      phone: u.phone,
      currentState: u.current_state,
      aadhaarVerified: u.aadhaar_verified,
      panMasked: u.pan_masked,
      requestedTier: u.requested_tier,
      submittedAt: u.submitted_at,
    }));
    res.json(queue);
  } catch (err) {
    console.error('[KycQueue] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Wallet App endpoints ────────────────────────────────────────────────────

// GET /api/wallet/balance/:walletId — Wallet: get balance
app.get('/api/wallet/balance/:walletId', (req, res) => {
  try {
    // Map wallet-user_001 → user_001 or just pass through
    const userId = req.params.walletId.replace('wallet-', '').replace('demo-wallet', 'user_001');
    const balance = getWalletBalance(userId);
    if (!balance) return res.status(404).json({ error: 'Wallet not found' });

    res.json({
      walletId: req.params.walletId,
      balancePaise: balance.balance_paise,
      heldPaise: String(Math.round(parseFloat(balance.held_amount.replace(/[₹,]/g, '')) * 100)),
      currency: 'INR',
      state: balance.status,
      kycTier: balance.kyc_tier,
    });
  } catch (err) {
    console.error('[WalletBalance] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/wallet/ledger/:walletId — Wallet: get ledger/transactions
app.get('/api/wallet/ledger/:walletId', (req, res) => {
  try {
    const userId = req.params.walletId.replace('wallet-', '').replace('demo-wallet', 'user_001');
    const limit = parseInt(req.query.limit) || 20;
    const history = getTransactionHistory(userId, 90, { limit });
    if (!history) return res.status(404).json({ error: 'Wallet not found' });

    const entries = history.transactions.map(t => ({
      id: t.txn_id,
      entry_type: t.entry_type === 'credit' ? 'CREDIT' : 'DEBIT',
      amount_paise: t.amount_paise,
      balance_after_paise: '0',
      transaction_type: t.type === 'load' ? 'ADD_MONEY' : t.type === 'pay' ? 'MERCHANT_PAY' : 'P2P_TRANSFER',
      description: t.description,
      created_at: t.timestamp,
    }));

    res.json({
      entries,
      cursor: null,
      has_more: false,
    });
  } catch (err) {
    console.error('[WalletLedger] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/wallet/status/:walletId — Wallet: get status
app.get('/api/wallet/status/:walletId', (req, res) => {
  try {
    const userId = req.params.walletId.replace('wallet-', '').replace('demo-wallet', 'user_001');
    const profile = getUserProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Wallet not found' });

    res.json({
      walletId: req.params.walletId,
      userId: profile.user_id,
      name: profile.name,
      phone: profile.phone,
      kycTier: profile.kyc.tier,
      kycState: profile.kyc.state,
      walletState: profile.status,
      createdAt: profile.created_at,
    });
  } catch (err) {
    console.error('[WalletStatus] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /api/wallet/transact — Wallet: execute a transaction ────────────────
// When a user performs a transaction in the wallet app, this endpoint
// updates mock-data.js so the AI agent sees the updated data.
app.post('/api/wallet/transact', (req, res) => {
  try {
    const { wallet_id, saga_type, amount_paise, counterparty, description, bill_number } = req.body;
    const userId = (wallet_id || 'demo-wallet').replace('wallet-', '').replace('demo-wallet', 'user_001');

    if (!amount_paise || !saga_type) {
      return res.status(400).json({ error: 'amount_paise and saga_type are required' });
    }

    let result;
    switch (saga_type) {
      case 'ADD_MONEY':
        result = addMoney(userId, { amount_paise: Number(amount_paise), source: description || 'UPI' });
        break;
      case 'MERCHANT_PAY':
        result = payMerchant(userId, { amount_paise: Number(amount_paise), merchant_name: counterparty || 'Unknown', description });
        break;
      case 'P2P_TRANSFER': {
        const recipientId = (counterparty || '').replace('wallet-', '');
        result = transferP2P(userId, { amount_paise: Number(amount_paise), recipient_id: recipientId, note: description });
        break;
      }
      case 'BILL_PAY':
        result = payBill(userId, { amount_paise: Number(amount_paise), biller_name: counterparty || 'Unknown', bill_number, category: 'Utilities' });
        break;
      default:
        return res.status(400).json({ error: `Unknown saga_type: ${saga_type}` });
    }

    if (result.error) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (err) {
    console.error('[Transact] Error:', err?.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PPI Wallet API server running on port ${PORT}`);
});
