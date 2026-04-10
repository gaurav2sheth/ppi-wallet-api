/**
 * Mock Data Layer for PPI Wallet MCP Server
 *
 * Provides 10 wallet users and ~40 realistic transactions
 * that mirror the real PostgreSQL schema (WalletAccount + LedgerEntry).
 *
 * All amounts are in INR. All timestamps are in IST (Asia/Kolkata).
 * Amounts stored as paise internally, displayed as rupees externally.
 */

// ── Utility: generate IST timestamps ────────────────────────────────────────
// Cache "now" at module load so timestamps stay consistent across server restarts
const MODULE_LOAD_TIME = new Date();

function daysAgo(n) {
  const d = new Date(MODULE_LOAD_TIME);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function now() {
  return MODULE_LOAD_TIME;
}

function formatIST(isoString) {
  return new Date(isoString).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function paisaToRupees(paise) {
  return (Number(paise) / 100).toFixed(2);
}

// ── 10 Wallet Users ──────────────────────────────────────────────────────────
const users = new Map([
  ['user_001', {
    user_id: 'user_001',
    name: 'Gaurav Sheth',
    phone: '+91-9876543210',
    balance_paise: 2361100n,   // ₹23,611.00
    held_paise: 0n,
    kyc_tier: 'FULL',
    state: 'ACTIVE',
    created_at: daysAgo(120),
    last_activity_at: daysAgo(0),
  }],
  ['user_002', {
    user_id: 'user_002',
    name: 'Priya Sharma',
    phone: '+91-9988776655',
    balance_paise: 875050n,    // ₹8,750.50
    held_paise: 50000n,        // ₹500 held
    kyc_tier: 'FULL',
    state: 'ACTIVE',
    created_at: daysAgo(90),
    last_activity_at: daysAgo(1),
  }],
  ['user_003', {
    user_id: 'user_003',
    name: 'Rohan Mehta',
    phone: '+91-8877665544',
    balance_paise: 342000n,    // ₹3,420.00
    held_paise: 0n,
    kyc_tier: 'MINIMUM',
    state: 'ACTIVE',
    created_at: daysAgo(60),
    last_activity_at: daysAgo(5),
  }],
  ['user_004', {
    user_id: 'user_004',
    name: 'Anita Desai',
    phone: '+91-7766554433',
    balance_paise: 15200000n,  // ₹1,52,000.00
    held_paise: 0n,
    kyc_tier: 'FULL',
    state: 'ACTIVE',
    created_at: daysAgo(200),
    last_activity_at: daysAgo(2),
  }],
  ['user_005', {
    user_id: 'user_005',
    name: 'Vikram Patel',
    phone: '+91-6655443322',
    balance_paise: 50000n,     // ₹500.00
    held_paise: 0n,
    kyc_tier: 'MINIMUM',
    state: 'SUSPENDED',
    created_at: daysAgo(45),
    last_activity_at: daysAgo(30),
  }],
  ['user_006', {
    user_id: 'user_006',
    name: 'Meera Iyer',
    phone: '+91-9123456780',
    balance_paise: 1200000n,   // ₹12,000.00
    held_paise: 0n,
    kyc_tier: 'FULL',
    state: 'ACTIVE',
    created_at: daysAgo(150),
    last_activity_at: daysAgo(1),
  }],
  ['user_007', {
    user_id: 'user_007',
    name: 'Arjun Singh',
    phone: '+91-9234567890',
    balance_paise: 180000n,    // ₹1,800.00
    held_paise: 0n,
    kyc_tier: 'MINIMUM',
    state: 'ACTIVE',
    created_at: daysAgo(30),
    last_activity_at: daysAgo(3),
  }],
  ['user_008', {
    user_id: 'user_008',
    name: 'Deepa Nair',
    phone: '+91-9345678901',
    balance_paise: 4500000n,   // ₹45,000.00
    held_paise: 200000n,       // ₹2,000 held
    kyc_tier: 'FULL',
    state: 'ACTIVE',
    created_at: daysAgo(180),
    last_activity_at: daysAgo(0),
  }],
  ['user_009', {
    user_id: 'user_009',
    name: 'Rahul Gupta',
    phone: '+91-9456789012',
    balance_paise: 20000n,     // ₹200.00
    held_paise: 0n,
    kyc_tier: 'FULL',
    state: 'DORMANT',
    created_at: daysAgo(300),
    last_activity_at: daysAgo(90),
  }],
  ['user_010', {
    user_id: 'user_010',
    name: 'Sneha Reddy',
    phone: '+91-9567890123',
    balance_paise: 650000n,    // ₹6,500.00
    held_paise: 0n,
    kyc_tier: 'MINIMUM',
    state: 'ACTIVE',
    created_at: daysAgo(75),
    last_activity_at: daysAgo(2),
  }],
]);

// ── 40 Transactions across users and last 90 days ────────────────────────────
const transactions = [
  // user_001 — 8 transactions (including recurring Netflix)
  { txn_id: 'txn_001', user_id: 'user_001', type: 'load', amount_paise: 1000000n, merchant: null, description: 'Wallet top-up via UPI', timestamp: daysAgo(1), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_002', user_id: 'user_001', type: 'pay', amount_paise: 89900n, merchant: 'Swiggy', description: 'Food delivery - Swiggy', timestamp: daysAgo(2), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_003', user_id: 'user_001', type: 'transfer', amount_paise: 500000n, merchant: null, description: 'P2P transfer to Priya Sharma', timestamp: daysAgo(3), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_004', user_id: 'user_001', type: 'pay', amount_paise: 1200000n, merchant: 'Amazon', description: 'Online purchase - Amazon', timestamp: daysAgo(5), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_005', user_id: 'user_001', type: 'load', amount_paise: 1500000n, merchant: null, description: 'Wallet top-up via Debit Card', timestamp: daysAgo(8), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_006', user_id: 'user_001', type: 'pay', amount_paise: 45000n, merchant: 'Uber', description: 'Uber ride - Airport', timestamp: daysAgo(10), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_021', user_id: 'user_001', type: 'pay', amount_paise: 64900n, merchant: 'Netflix', description: 'Netflix Premium - Monthly', timestamp: daysAgo(15), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_022', user_id: 'user_001', type: 'pay', amount_paise: 64900n, merchant: 'Netflix', description: 'Netflix Premium - Monthly', timestamp: daysAgo(45), status: 'success', flagged: false, flag_reason: null, flagged_at: null },

  // user_002 — 6 transactions
  { txn_id: 'txn_007', user_id: 'user_002', type: 'load', amount_paise: 500000n, merchant: null, description: 'Wallet top-up via UPI', timestamp: daysAgo(1), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_008', user_id: 'user_002', type: 'pay', amount_paise: 250000n, merchant: 'BigBasket', description: 'Groceries - BigBasket', timestamp: daysAgo(2), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_009', user_id: 'user_002', type: 'transfer', amount_paise: 150000n, merchant: null, description: 'P2P transfer to Rohan Mehta', timestamp: daysAgo(4), status: 'pending', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_010', user_id: 'user_002', type: 'pay', amount_paise: 1100000n, merchant: 'Flipkart', description: 'Online purchase - Flipkart', timestamp: daysAgo(7), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_011', user_id: 'user_002', type: 'pay', amount_paise: 75000n, merchant: 'Zomato', description: 'Food delivery - Zomato', timestamp: daysAgo(12), status: 'failed', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_023', user_id: 'user_002', type: 'pay', amount_paise: 11900n, merchant: 'Spotify', description: 'Spotify Premium - Monthly', timestamp: daysAgo(5), status: 'success', flagged: false, flag_reason: null, flagged_at: null },

  // user_003 — 5 transactions
  { txn_id: 'txn_012', user_id: 'user_003', type: 'load', amount_paise: 200000n, merchant: null, description: 'Wallet top-up via UPI', timestamp: daysAgo(3), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_013', user_id: 'user_003', type: 'pay', amount_paise: 55000n, merchant: 'Ola', description: 'Ola ride - Bandra to Andheri', timestamp: daysAgo(6), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_014', user_id: 'user_003', type: 'pay', amount_paise: 120000n, merchant: 'BookMyShow', description: 'Movie tickets - BookMyShow', timestamp: daysAgo(9), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_015', user_id: 'user_003', type: 'transfer', amount_paise: 300000n, merchant: null, description: 'P2P transfer to Vikram Patel', timestamp: daysAgo(15), status: 'failed', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_024', user_id: 'user_003', type: 'pay', amount_paise: 49900n, merchant: 'Jio Recharge', description: 'Jio Prepaid Recharge - ₹499', timestamp: daysAgo(20), status: 'success', flagged: false, flag_reason: null, flagged_at: null },

  // user_004 — 4 transactions (high-value — suspicious candidates)
  { txn_id: 'txn_016', user_id: 'user_004', type: 'load', amount_paise: 1500000n, merchant: null, description: 'Wallet top-up via NEFT', timestamp: daysAgo(2), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_017', user_id: 'user_004', type: 'transfer', amount_paise: 1200000n, merchant: null, description: 'P2P transfer to unknown wallet ID', timestamp: daysAgo(3), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_018', user_id: 'user_004', type: 'load', amount_paise: 1000000n, merchant: null, description: 'Wallet top-up via UPI - 3rd load this week', timestamp: daysAgo(4), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_025', user_id: 'user_004', type: 'pay', amount_paise: 2500000n, merchant: 'MakeMyTrip', description: 'Flight booking - MakeMyTrip Delhi to Mumbai', timestamp: daysAgo(6), status: 'success', flagged: false, flag_reason: null, flagged_at: null },

  // user_005 — 2 transactions (suspended account)
  { txn_id: 'txn_019', user_id: 'user_005', type: 'load', amount_paise: 100000n, merchant: null, description: 'Wallet top-up via UPI', timestamp: daysAgo(25), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_020', user_id: 'user_005', type: 'pay', amount_paise: 50000n, merchant: 'DMart', description: 'Groceries - DMart', timestamp: daysAgo(28), status: 'success', flagged: false, flag_reason: null, flagged_at: null },

  // user_006 (Meera Iyer) — 5 transactions (recurring Swiggy + Netflix)
  { txn_id: 'txn_026', user_id: 'user_006', type: 'load', amount_paise: 500000n, merchant: null, description: 'Wallet top-up via UPI', timestamp: daysAgo(1), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_027', user_id: 'user_006', type: 'pay', amount_paise: 35000n, merchant: 'Starbucks', description: 'Starbucks - Latte & Croissant', timestamp: daysAgo(2), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_028', user_id: 'user_006', type: 'pay', amount_paise: 64900n, merchant: 'Netflix', description: 'Netflix Premium - Monthly', timestamp: daysAgo(10), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_029', user_id: 'user_006', type: 'pay', amount_paise: 64900n, merchant: 'Netflix', description: 'Netflix Premium - Monthly', timestamp: daysAgo(40), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_030', user_id: 'user_006', type: 'pay', amount_paise: 125000n, merchant: 'Myntra', description: 'Online shopping - Myntra', timestamp: daysAgo(14), status: 'success', flagged: false, flag_reason: null, flagged_at: null },

  // user_007 (Arjun Singh) — 3 transactions
  { txn_id: 'txn_031', user_id: 'user_007', type: 'load', amount_paise: 200000n, merchant: null, description: 'Wallet top-up via UPI', timestamp: daysAgo(3), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_032', user_id: 'user_007', type: 'pay', amount_paise: 29900n, merchant: 'Airtel', description: 'Airtel Prepaid Recharge', timestamp: daysAgo(5), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_033', user_id: 'user_007', type: 'pay', amount_paise: 85000n, merchant: 'Swiggy', description: 'Food delivery - Swiggy', timestamp: daysAgo(7), status: 'failed', flagged: false, flag_reason: null, flagged_at: null },

  // user_008 (Deepa Nair) — 4 transactions (high spender)
  { txn_id: 'txn_034', user_id: 'user_008', type: 'load', amount_paise: 2000000n, merchant: null, description: 'Wallet top-up via NEFT', timestamp: daysAgo(1), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_035', user_id: 'user_008', type: 'pay', amount_paise: 1800000n, merchant: 'MakeMyTrip', description: 'Hotel booking - MakeMyTrip Goa', timestamp: daysAgo(3), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_036', user_id: 'user_008', type: 'pay', amount_paise: 250000n, merchant: 'Apollo Pharmacy', description: 'Apollo Pharmacy - Medicines', timestamp: daysAgo(5), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_037', user_id: 'user_008', type: 'transfer', amount_paise: 500000n, merchant: null, description: 'P2P transfer to Meera Iyer', timestamp: daysAgo(7), status: 'pending', flagged: false, flag_reason: null, flagged_at: null },

  // user_009 (Rahul Gupta) — 1 transaction (dormant)
  { txn_id: 'txn_038', user_id: 'user_009', type: 'pay', amount_paise: 15000n, merchant: 'Cred', description: 'Cred cashback redemption', timestamp: daysAgo(85), status: 'success', flagged: false, flag_reason: null, flagged_at: null },

  // user_010 (Sneha Reddy) — 3 transactions
  { txn_id: 'txn_039', user_id: 'user_010', type: 'load', amount_paise: 300000n, merchant: null, description: 'Wallet top-up via UPI', timestamp: daysAgo(2), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_040', user_id: 'user_010', type: 'pay', amount_paise: 180000n, merchant: 'Reliance Fresh', description: 'Groceries - Reliance Fresh', timestamp: daysAgo(4), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_041', user_id: 'user_010', type: 'pay', amount_paise: 350000n, merchant: 'IRCTC', description: 'Train ticket - IRCTC Mumbai to Pune', timestamp: daysAgo(8), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
];

// ── Data Access Functions ─────────────────────────────────────────────────────

export function getWalletBalance(userId) {
  const user = users.get(userId);
  if (!user) return null;

  return {
    user_id: user.user_id,
    name: user.name,
    balance: `₹${paisaToRupees(user.balance_paise)}`,
    balance_paise: user.balance_paise.toString(),
    held_amount: `₹${paisaToRupees(user.held_paise)}`,
    currency: 'INR',
    kyc_tier: user.kyc_tier,
    status: user.state,
    last_updated: formatIST(user.last_activity_at),
  };
}

// Maps transaction type to entry_type (credit = money in, debit = money out)
function getEntryType(txnType) {
  return txnType === 'load' ? 'credit' : 'debit';
}

// ── Expanded Merchant → Category mapping ─────────────────────────────────────
const MERCHANT_CATEGORIES = {
  'Swiggy': 'Food & Dining',
  'Zomato': 'Food & Dining',
  'Starbucks': 'Food & Dining',
  'BigBasket': 'Groceries',
  'DMart': 'Groceries',
  'Reliance Fresh': 'Groceries',
  'Amazon': 'Shopping',
  'Flipkart': 'Shopping',
  'Myntra': 'Shopping',
  'Uber': 'Travel',
  'Ola': 'Travel',
  'IRCTC': 'Travel',
  'MakeMyTrip': 'Travel',
  'BookMyShow': 'Entertainment',
  'Netflix': 'Entertainment',
  'Spotify': 'Entertainment',
  'Jio Recharge': 'Utilities',
  'Airtel': 'Utilities',
  'Apollo Pharmacy': 'Health',
  'Cred': 'Bill Payment',
};

function getCategory(txn) {
  if (txn.type === 'load') return 'Wallet Top-up';
  if (txn.type === 'transfer') return 'P2P Transfer';
  return MERCHANT_CATEGORIES[txn.merchant] ?? 'Other';
}

// ── RBI PPI Limits by KYC Tier ───────────────────────────────────────────────
const KYC_LIMITS = {
  MINIMUM: { daily: 1000000, monthly: 1000000, max_balance: 1000000, label: 'Minimum KYC (₹10,000)' },
  FULL:    { daily: 10000000, monthly: 20000000, max_balance: 20000000, label: 'Full KYC (₹2,00,000)' },
};

/**
 * Get transactions for a user within the last N days.
 * Supports optional filters: entry_type, transaction_type, limit, offset.
 * Returns transactions sorted by timestamp descending (most recent first).
 */
export function getTransactionHistory(userId, days = 7, { entry_type, transaction_type, limit, offset = 0 } = {}) {
  const user = users.get(userId);
  if (!user) return null;

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  let userTxns = transactions
    .filter(t => t.user_id === userId && new Date(t.timestamp) >= cutoff)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map(t => ({
      txn_id: t.txn_id,
      type: t.type,
      entry_type: getEntryType(t.type),
      amount: `₹${paisaToRupees(t.amount_paise)}`,
      amount_paise: t.amount_paise.toString(),
      merchant: t.merchant ?? 'N/A',
      description: t.description,
      timestamp: formatIST(t.timestamp),
      status: t.status,
      flagged: t.flagged,
    }));

  if (entry_type) {
    userTxns = userTxns.filter(t => t.entry_type === entry_type.toLowerCase());
  }
  if (transaction_type) {
    userTxns = userTxns.filter(t => t.type === transaction_type.toLowerCase());
  }

  const totalAmountPaise = userTxns.reduce((sum, t) => sum + Number(t.amount_paise), 0);
  const totalMatching = userTxns.length;

  // Apply pagination
  const effectiveLimit = (limit && limit > 0) ? limit : 10;
  const effectiveOffset = offset > 0 ? offset : 0;
  userTxns = userTxns.slice(effectiveOffset, effectiveOffset + effectiveLimit);

  return {
    user_id: userId,
    name: user.name,
    days,
    filters_applied: {
      ...(entry_type ? { entry_type } : {}),
      ...(transaction_type ? { transaction_type } : {}),
      ...(limit ? { limit } : {}),
      ...(offset > 0 ? { offset } : {}),
    },
    total_matching: totalMatching,
    total_returned: userTxns.length,
    total_amount: `₹${(totalAmountPaise / 100).toFixed(2)}`,
    transactions: userTxns,
  };
}

/**
 * Get spending summary with category-wise breakdown.
 * Now includes both spending (debits) AND income (credits) sections.
 */
export function getSpendingSummary(userId, days = 30) {
  const user = users.get(userId);
  if (!user) return null;

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  const allTxns = transactions.filter(
    t => t.user_id === userId && new Date(t.timestamp) >= cutoff
  );

  // ── Spending (debits) ──
  const debitTxns = allTxns.filter(t => t.type !== 'load');
  const categories = {};
  let totalSpentPaise = 0;

  for (const t of debitTxns) {
    const cat = getCategory(t);
    if (!categories[cat]) {
      categories[cat] = { count: 0, total_paise: 0, transactions: [] };
    }
    categories[cat].count++;
    categories[cat].total_paise += Number(t.amount_paise);
    categories[cat].transactions.push({
      txn_id: t.txn_id,
      amount: `₹${paisaToRupees(t.amount_paise)}`,
      merchant: t.merchant ?? 'N/A',
      description: t.description,
      timestamp: formatIST(t.timestamp),
    });
    totalSpentPaise += Number(t.amount_paise);
  }

  const breakdown = Object.entries(categories).map(([category, data]) => ({
    category,
    count: data.count,
    total: `₹${(data.total_paise / 100).toFixed(2)}`,
    percentage: totalSpentPaise > 0 ? `${((data.total_paise / totalSpentPaise) * 100).toFixed(1)}%` : '0%',
    transactions: data.transactions,
  })).sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));

  // ── Income (credits) ──
  const creditTxns = allTxns.filter(t => t.type === 'load');
  const totalIncomePaise = creditTxns.reduce((s, t) => s + Number(t.amount_paise), 0);

  const incomeTransactions = creditTxns
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map(t => ({
      txn_id: t.txn_id,
      amount: `₹${paisaToRupees(t.amount_paise)}`,
      description: t.description,
      timestamp: formatIST(t.timestamp),
    }));

  const netFlowPaise = totalIncomePaise - totalSpentPaise;

  return {
    user_id: userId,
    name: user.name,
    days,
    spending: {
      total_spent: `₹${(totalSpentPaise / 100).toFixed(2)}`,
      total_transactions: debitTxns.length,
      avg_per_day: `₹${((totalSpentPaise / 100) / days).toFixed(2)}`,
      categories: breakdown,
    },
    income: {
      total_income: `₹${(totalIncomePaise / 100).toFixed(2)}`,
      transaction_count: creditTxns.length,
      avg_per_day: `₹${((totalIncomePaise / 100) / days).toFixed(2)}`,
      transactions: incomeTransactions,
    },
    net_flow: {
      amount: `${netFlowPaise >= 0 ? '+' : '-'}₹${(Math.abs(netFlowPaise) / 100).toFixed(2)}`,
      direction: netFlowPaise >= 0 ? 'positive' : 'negative',
    },
  };
}

/**
 * Search transactions by merchant name, description keyword, or amount range.
 * Supports limit and offset for pagination.
 * Returns results sorted by timestamp descending.
 */
export function searchTransactions(userId, { query, min_amount, max_amount, days = 30, limit, offset = 0 } = {}) {
  const user = users.get(userId);
  if (!user) return null;

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  let results = transactions
    .filter(t => t.user_id === userId && new Date(t.timestamp) >= cutoff)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map(t => ({
      txn_id: t.txn_id,
      type: t.type,
      entry_type: getEntryType(t.type),
      amount: `₹${paisaToRupees(t.amount_paise)}`,
      amount_paise: t.amount_paise.toString(),
      merchant: t.merchant ?? 'N/A',
      description: t.description,
      category: getCategory(t),
      timestamp: formatIST(t.timestamp),
      status: t.status,
    }));

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(t =>
      t.merchant.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q)
    );
  }

  if (min_amount) {
    const minPaise = Math.round(min_amount * 100);
    results = results.filter(t => Number(t.amount_paise) >= minPaise);
  }

  if (max_amount) {
    const maxPaise = Math.round(max_amount * 100);
    results = results.filter(t => Number(t.amount_paise) <= maxPaise);
  }

  const totalPaise = results.reduce((sum, t) => sum + Number(t.amount_paise), 0);
  const totalMatches = results.length;

  // Apply pagination
  const effectiveLimit = (limit && limit > 0) ? limit : 20;
  const effectiveOffset = offset > 0 ? offset : 0;
  results = results.slice(effectiveOffset, effectiveOffset + effectiveLimit);

  return {
    user_id: userId,
    name: user.name,
    search_criteria: {
      ...(query ? { query } : {}),
      ...(min_amount ? { min_amount: `₹${min_amount}` } : {}),
      ...(max_amount ? { max_amount: `₹${max_amount}` } : {}),
      days,
      ...(limit ? { limit } : {}),
      ...(offset > 0 ? { offset } : {}),
    },
    total_matches: totalMatches,
    total_returned: results.length,
    total_amount: `₹${(totalPaise / 100).toFixed(2)}`,
    transactions: results,
  };
}

/**
 * Get full user profile including KYC details and limits.
 */
export function getUserProfile(userId) {
  const user = users.get(userId);
  if (!user) return null;

  const limits = KYC_LIMITS[user.kyc_tier] ?? KYC_LIMITS.MINIMUM;
  const accountAgeDays = Math.floor((now().getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - 30);
  const recentTxns = transactions.filter(t => t.user_id === userId && new Date(t.timestamp) >= cutoff);
  const flaggedCount = transactions.filter(t => t.user_id === userId && t.flagged).length;

  return {
    user_id: user.user_id,
    name: user.name,
    phone: user.phone,
    status: user.state,
    kyc_tier: user.kyc_tier,
    kyc_label: limits.label,
    balance: `₹${paisaToRupees(user.balance_paise)}`,
    balance_paise: user.balance_paise.toString(),
    held_amount: `₹${paisaToRupees(user.held_paise)}`,
    available_balance: `₹${paisaToRupees(user.balance_paise - user.held_paise)}`,
    limits: {
      daily_limit: `₹${(limits.daily / 100).toFixed(2)}`,
      monthly_limit: `₹${(limits.monthly / 100).toFixed(2)}`,
      max_balance: `₹${(limits.max_balance / 100).toFixed(2)}`,
    },
    account_age_days: accountAgeDays,
    created_at: formatIST(user.created_at),
    last_activity: formatIST(user.last_activity_at),
    recent_activity: {
      transactions_last_30_days: recentTxns.length,
      flagged_transactions: flaggedCount,
    },
  };
}

/**
 * Compare spending between two consecutive time periods.
 * Handles zero-to-nonzero transitions gracefully.
 */
export function compareSpending(userId, { period1_days = 7, period2_days = 7 } = {}) {
  const user = users.get(userId);
  if (!user) return null;

  const n = now();
  const p1Start = new Date(n); p1Start.setDate(p1Start.getDate() - period1_days);
  const p2End = new Date(p1Start);
  const p2Start = new Date(p2End); p2Start.setDate(p2Start.getDate() - period2_days);

  const p1Txns = transactions.filter(
    t => t.user_id === userId && t.type !== 'load' &&
      new Date(t.timestamp) >= p1Start && new Date(t.timestamp) < n
  );
  const p2Txns = transactions.filter(
    t => t.user_id === userId && t.type !== 'load' &&
      new Date(t.timestamp) >= p2Start && new Date(t.timestamp) < p2End
  );

  const p1Total = p1Txns.reduce((s, t) => s + Number(t.amount_paise), 0);
  const p2Total = p2Txns.reduce((s, t) => s + Number(t.amount_paise), 0);

  const changePaise = p1Total - p2Total;

  let changePercent;
  let note = null;
  if (p2Total === 0 && p1Total > 0) {
    changePercent = 'N/A';
    note = 'No spending in comparison period — percentage change not applicable';
  } else if (p2Total === 0 && p1Total === 0) {
    changePercent = '0.0%';
  } else {
    changePercent = `${((changePaise / p2Total) * 100) >= 0 ? '+' : ''}${((changePaise / p2Total) * 100).toFixed(1)}%`;
  }

  return {
    user_id: userId,
    name: user.name,
    period1: {
      label: `Last ${period1_days} days`,
      days: period1_days,
      total_spent: `₹${(p1Total / 100).toFixed(2)}`,
      transaction_count: p1Txns.length,
      avg_per_day: `₹${((p1Total / 100) / period1_days).toFixed(2)}`,
    },
    period2: {
      label: `Previous ${period2_days} days`,
      days: period2_days,
      total_spent: `₹${(p2Total / 100).toFixed(2)}`,
      transaction_count: p2Txns.length,
      avg_per_day: `₹${((p2Total / 100) / period2_days).toFixed(2)}`,
    },
    comparison: {
      change_amount: `${changePaise >= 0 ? '+' : '-'}₹${(Math.abs(changePaise) / 100).toFixed(2)}`,
      change_percent: changePercent,
      trend: changePaise > 0 ? 'spending_increased' : changePaise < 0 ? 'spending_decreased' : 'no_change',
      ...(note ? { note } : {}),
    },
  };
}

/**
 * Estimate how long the user's balance will last based on average daily spending.
 * Includes absolute balance warning for low balances (<₹1,000).
 */
export function estimateBalanceRunway(userId, { lookback_days = 30 } = {}) {
  const user = users.get(userId);
  if (!user) return null;

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - lookback_days);

  const debitTxns = transactions.filter(
    t => t.user_id === userId && t.type !== 'load' && new Date(t.timestamp) >= cutoff
  );

  const totalSpentPaise = debitTxns.reduce((s, t) => s + Number(t.amount_paise), 0);
  const avgDailySpend = totalSpentPaise / lookback_days;
  const balancePaise = Number(user.balance_paise);

  const daysRemaining = avgDailySpend > 0 ? Math.floor(balancePaise / avgDailySpend) : null;
  const estimatedDate = daysRemaining !== null
    ? new Date(now().getTime() + daysRemaining * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
    : null;

  const lowBalance = balancePaise < 100000; // < ₹1,000

  let recommendation;
  if (daysRemaining === null) {
    recommendation = 'No spending detected in this period — balance is stable.';
  } else if (lowBalance) {
    recommendation = 'Balance critically low (under ₹1,000). Top up your wallet immediately.';
  } else if (daysRemaining < 7) {
    recommendation = 'Balance running low! Consider topping up your wallet soon.';
  } else if (daysRemaining < 30) {
    recommendation = 'Balance should last a few more weeks at current spending rate.';
  } else {
    recommendation = 'Balance is healthy at your current spending rate.';
  }

  return {
    user_id: userId,
    name: user.name,
    current_balance: `₹${paisaToRupees(user.balance_paise)}`,
    low_balance_warning: lowBalance,
    analysis_period: `Last ${lookback_days} days`,
    total_spent: `₹${(totalSpentPaise / 100).toFixed(2)}`,
    transactions_count: debitTxns.length,
    avg_daily_spend: `₹${(avgDailySpend / 100).toFixed(2)}`,
    estimated_days_remaining: daysRemaining,
    estimated_exhaustion_date: estimatedDate,
    recommendation,
  };
}

export function listUsers() {
  return Array.from(users.values()).map(u => ({
    user_id: u.user_id,
    name: u.name,
    status: u.state,
    balance: `₹${paisaToRupees(u.balance_paise)}`,
  }));
}

/**
 * Flag a specific transaction as suspicious.
 */
export function flagSuspiciousTransaction(txnId, reason) {
  const txn = transactions.find(t => t.txn_id === txnId);
  if (!txn) return null;

  txn.flagged = true;
  txn.flag_reason = reason;
  txn.flagged_at = now().toISOString();

  return {
    txn_id: txn.txn_id,
    user_id: txn.user_id,
    amount: `₹${paisaToRupees(txn.amount_paise)}`,
    description: txn.description,
    flagged: true,
    reason,
    flagged_at: formatIST(txn.flagged_at),
    flagged_by: 'claude-ai',
  };
}

/**
 * Unflag a previously flagged transaction.
 */
export function unflagTransaction(txnId, reason) {
  const txn = transactions.find(t => t.txn_id === txnId);
  if (!txn) return null;

  if (!txn.flagged) {
    return {
      success: false,
      txn_id: txnId,
      message: 'Transaction is not currently flagged.',
    };
  }

  const previousReason = txn.flag_reason;
  txn.flagged = false;
  txn.flag_reason = null;
  txn.flagged_at = null;

  return {
    success: true,
    txn_id: txn.txn_id,
    user_id: txn.user_id,
    amount: `₹${paisaToRupees(txn.amount_paise)}`,
    description: txn.description,
    flagged: false,
    previous_flag_reason: previousReason,
    unflag_reason: reason,
    unflagged_at: formatIST(now().toISOString()),
    unflagged_by: 'claude-ai',
  };
}

/**
 * Detect recurring payments for a user (subscriptions, regular payments).
 */
export function detectRecurringPayments(userId, { days = 90, min_occurrences = 2 } = {}) {
  const user = users.get(userId);
  if (!user) return null;

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  const userTxns = transactions
    .filter(t => t.user_id === userId && t.type === 'pay' && new Date(t.timestamp) >= cutoff && t.status === 'success')
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Group by merchant
  const merchantGroups = {};
  for (const t of userTxns) {
    if (!t.merchant) continue;
    if (!merchantGroups[t.merchant]) merchantGroups[t.merchant] = [];
    merchantGroups[t.merchant].push(t);
  }

  const recurring = [];
  for (const [merchant, txns] of Object.entries(merchantGroups)) {
    if (txns.length < min_occurrences) continue;

    const amounts = txns.map(t => Number(t.amount_paise));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountVariance = amounts.every(a => Math.abs(a - avgAmount) / avgAmount < 0.1);

    // Calculate intervals between transactions
    const intervals = [];
    for (let i = 1; i < txns.length; i++) {
      const diff = (new Date(txns[i].timestamp) - new Date(txns[i - 1].timestamp)) / (1000 * 60 * 60 * 24);
      intervals.push(diff);
    }

    const avgInterval = intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;

    // Determine frequency
    let frequency;
    if (avgInterval >= 25 && avgInterval <= 35) frequency = 'monthly';
    else if (avgInterval >= 12 && avgInterval <= 18) frequency = 'bi-weekly';
    else if (avgInterval >= 5 && avgInterval <= 9) frequency = 'weekly';
    else frequency = `every ~${Math.round(avgInterval)} days`;

    // Estimate next payment date
    const lastTxnDate = new Date(txns[txns.length - 1].timestamp);
    const nextDate = new Date(lastTxnDate);
    nextDate.setDate(nextDate.getDate() + Math.round(avgInterval));

    recurring.push({
      merchant,
      category: MERCHANT_CATEGORIES[merchant] ?? 'Other',
      occurrence_count: txns.length,
      amount: amountVariance ? `₹${paisaToRupees(BigInt(Math.round(avgAmount)))}` : `₹${paisaToRupees(BigInt(Math.round(Math.min(...amounts))))} - ₹${paisaToRupees(BigInt(Math.round(Math.max(...amounts))))}`,
      is_fixed_amount: amountVariance,
      frequency,
      avg_interval_days: Math.round(avgInterval),
      last_payment: formatIST(txns[txns.length - 1].timestamp),
      next_expected: formatIST(nextDate.toISOString()),
      monthly_cost_estimate: `₹${((avgAmount / 100) * (30 / (avgInterval || 30))).toFixed(2)}`,
    });
  }

  const totalMonthly = recurring.reduce((sum, r) => {
    const amt = parseFloat(r.monthly_cost_estimate.replace('₹', ''));
    return sum + amt;
  }, 0);

  return {
    user_id: userId,
    name: user.name,
    analysis_period: `Last ${days} days`,
    recurring_count: recurring.length,
    total_monthly_estimate: `₹${totalMonthly.toFixed(2)}`,
    recurring_payments: recurring,
    ...(recurring.length === 0 ? { note: 'No recurring payment patterns detected in this period.' } : {}),
  };
}

/**
 * Compare multiple users side-by-side.
 */
export function compareUsers(userIds, { days = 30 } = {}) {
  const results = [];
  const notFound = [];

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  for (const userId of userIds) {
    const user = users.get(userId);
    if (!user) { notFound.push(userId); continue; }

    const userTxns = transactions.filter(t => t.user_id === userId && new Date(t.timestamp) >= cutoff);
    const debitTxns = userTxns.filter(t => t.type !== 'load');
    const creditTxns = userTxns.filter(t => t.type === 'load');
    const spentPaise = debitTxns.reduce((s, t) => s + Number(t.amount_paise), 0);
    const incomePaise = creditTxns.reduce((s, t) => s + Number(t.amount_paise), 0);

    // Find top category
    const catSpend = {};
    for (const t of debitTxns) {
      const cat = getCategory(t);
      catSpend[cat] = (catSpend[cat] || 0) + Number(t.amount_paise);
    }
    const topCategory = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];

    results.push({
      user_id: userId,
      name: user.name,
      status: user.state,
      kyc_tier: user.kyc_tier,
      balance: `₹${paisaToRupees(user.balance_paise)}`,
      balance_paise: Number(user.balance_paise),
      total_spending: `₹${(spentPaise / 100).toFixed(2)}`,
      spending_paise: spentPaise,
      total_income: `₹${(incomePaise / 100).toFixed(2)}`,
      transaction_count: userTxns.length,
      avg_transaction: userTxns.length > 0
        ? `₹${(((spentPaise + incomePaise) / userTxns.length) / 100).toFixed(2)}`
        : '₹0.00',
      top_category: topCategory ? topCategory[0] : 'N/A',
    });
  }

  // Summary
  const highestSpender = [...results].sort((a, b) => b.spending_paise - a.spending_paise)[0];
  const highestBalance = [...results].sort((a, b) => b.balance_paise - a.balance_paise)[0];
  const mostActive = [...results].sort((a, b) => b.transaction_count - a.transaction_count)[0];

  return {
    period: `Last ${days} days`,
    users_compared: results.length,
    ...(notFound.length > 0 ? { users_not_found: notFound } : {}),
    users: results.map(({ balance_paise, spending_paise, ...rest }) => rest),
    summary: results.length >= 2 ? {
      highest_spender: highestSpender ? `${highestSpender.name} (${highestSpender.total_spending})` : 'N/A',
      highest_balance: highestBalance ? `${highestBalance.name} (${highestBalance.balance})` : 'N/A',
      most_active: mostActive ? `${mostActive.name} (${mostActive.transaction_count} transactions)` : 'N/A',
    } : undefined,
  };
}

/**
 * Generate a comprehensive report for a user.
 * report_type: 'summary' | 'detailed' | 'risk'
 */
export function generateReport(userId, { days = 30, report_type = 'summary' } = {}) {
  const user = users.get(userId);
  if (!user) return null;

  const reportId = `RPT-${userId.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const balance = getWalletBalance(userId);
  const spending = getSpendingSummary(userId, days);
  const runway = estimateBalanceRunway(userId, { lookback_days: days });

  const report = {
    report_id: reportId,
    report_type,
    generated_at: formatIST(now().toISOString()),
    period: `Last ${days} days`,
    user_summary: {
      user_id: userId,
      name: user.name,
      status: user.state,
      kyc_tier: user.kyc_tier,
      balance: balance.balance,
      available_balance: `₹${paisaToRupees(user.balance_paise - user.held_paise)}`,
    },
    financial_overview: {
      total_spending: spending.spending.total_spent,
      total_income: spending.income.total_income,
      net_flow: spending.net_flow.amount,
      avg_daily_spend: spending.spending.avg_per_day,
      category_count: spending.spending.categories.length,
      top_category: spending.spending.categories[0]?.category ?? 'N/A',
    },
    balance_forecast: {
      days_remaining: runway.estimated_days_remaining,
      exhaustion_date: runway.estimated_exhaustion_date,
      low_balance_warning: runway.low_balance_warning,
      recommendation: runway.recommendation,
    },
  };

  if (report_type === 'detailed' || report_type === 'risk') {
    report.spending_breakdown = spending.spending.categories;
    report.income_details = spending.income;

    const txnHistory = getTransactionHistory(userId, days, { limit: 50 });
    report.recent_transactions = {
      total: txnHistory.total_matching,
      transactions: txnHistory.transactions,
    };
  }

  if (report_type === 'risk') {
    const risk = getUserRiskProfile(userId);
    report.risk_assessment = risk.risk_assessment;
    report.activity_summary = risk.activity_summary;
    report.flagged_details = risk.flagged_details;
  }

  return report;
}


// ═════════════════════════════════════════════════════════════════════════════
// ADMIN-FACING TOOLS
// ═════════════════════════════════════════════════════════════════════════════

export function getSystemStats() {
  const allUsers = Array.from(users.values());
  const totalUsers = allUsers.length;
  const activeUsers = allUsers.filter(u => u.state === 'ACTIVE').length;
  const suspendedUsers = allUsers.filter(u => u.state === 'SUSPENDED').length;
  const dormantUsers = allUsers.filter(u => u.state === 'DORMANT').length;

  const totalAumPaise = allUsers.reduce((s, u) => s + Number(u.balance_paise), 0);
  const totalHeldPaise = allUsers.reduce((s, u) => s + Number(u.held_paise), 0);

  const kycFull = allUsers.filter(u => u.kyc_tier === 'FULL').length;
  const kycMinimum = allUsers.filter(u => u.kyc_tier === 'MINIMUM').length;

  const n = now();
  const oneDayAgo = new Date(n); oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const sevenDaysAgo = new Date(n); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date(n); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const txns24h = transactions.filter(t => new Date(t.timestamp) >= oneDayAgo);
  const txns7d = transactions.filter(t => new Date(t.timestamp) >= sevenDaysAgo);
  const txns30d = transactions.filter(t => new Date(t.timestamp) >= thirtyDaysAgo);

  const totalVolume24hPaise = txns24h.reduce((s, t) => s + Number(t.amount_paise), 0);
  const totalVolume7dPaise = txns7d.reduce((s, t) => s + Number(t.amount_paise), 0);
  const totalVolume30dPaise = txns30d.reduce((s, t) => s + Number(t.amount_paise), 0);

  const flaggedTxns = transactions.filter(t => t.flagged);
  const failedTxns = transactions.filter(t => t.status === 'failed');
  const pendingTxns = transactions.filter(t => t.status === 'pending');

  const avgBalancePaise = totalUsers > 0 ? Math.round(totalAumPaise / totalUsers) : 0;

  return {
    platform_overview: {
      total_users: totalUsers,
      active_users: activeUsers,
      suspended_users: suspendedUsers,
      dormant_users: dormantUsers,
    },
    kyc_breakdown: {
      full_kyc: kycFull,
      minimum_kyc: kycMinimum,
      kyc_completion_rate: `${((kycFull / totalUsers) * 100).toFixed(1)}%`,
    },
    financials: {
      total_aum: `₹${paisaToRupees(totalAumPaise)}`,
      total_held: `₹${paisaToRupees(totalHeldPaise)}`,
      avg_balance_per_user: `₹${paisaToRupees(avgBalancePaise)}`,
    },
    transaction_volume: {
      last_24h: { count: txns24h.length, volume: `₹${paisaToRupees(totalVolume24hPaise)}` },
      last_7d: { count: txns7d.length, volume: `₹${paisaToRupees(totalVolume7dPaise)}` },
      last_30d: { count: txns30d.length, volume: `₹${paisaToRupees(totalVolume30dPaise)}` },
    },
    alerts: {
      flagged_transactions: flaggedTxns.length,
      failed_transactions: failedTxns.length,
      pending_transactions: pendingTxns.length,
    },
    generated_at: formatIST(now().toISOString()),
  };
}

export function searchUsers({ query, kyc_tier, status, min_balance, max_balance, limit, offset = 0 } = {}) {
  let results = Array.from(users.values());

  if (query) {
    const q = query.toLowerCase();
    results = results.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      u.user_id.toLowerCase().includes(q)
    );
  }
  if (kyc_tier) results = results.filter(u => u.kyc_tier === kyc_tier.toUpperCase());
  if (status) results = results.filter(u => u.state === status.toUpperCase());
  if (min_balance !== undefined && min_balance !== null) {
    results = results.filter(u => Number(u.balance_paise) >= Math.round(min_balance * 100));
  }
  if (max_balance !== undefined && max_balance !== null) {
    results = results.filter(u => Number(u.balance_paise) <= Math.round(max_balance * 100));
  }

  const totalMatches = results.length;
  const effectiveLimit = (limit && limit > 0) ? limit : 20;
  const effectiveOffset = offset > 0 ? offset : 0;
  results = results.slice(effectiveOffset, effectiveOffset + effectiveLimit);

  return {
    total_matches: totalMatches,
    total_returned: results.length,
    search_criteria: {
      ...(query ? { query } : {}),
      ...(kyc_tier ? { kyc_tier } : {}),
      ...(status ? { status } : {}),
      ...(min_balance !== undefined && min_balance !== null ? { min_balance: `₹${min_balance}` } : {}),
      ...(max_balance !== undefined && max_balance !== null ? { max_balance: `₹${max_balance}` } : {}),
    },
    users: results.map(u => ({
      user_id: u.user_id,
      name: u.name,
      phone: u.phone,
      balance: `₹${paisaToRupees(u.balance_paise)}`,
      kyc_tier: u.kyc_tier,
      status: u.state,
      created_at: formatIST(u.created_at),
      last_activity: formatIST(u.last_activity_at),
    })),
  };
}

export function getFlaggedTransactions({ days = 30, limit, offset = 0 } = {}) {
  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  const flagged = transactions
    .filter(t => t.flagged)
    .map(t => {
      const user = users.get(t.user_id);
      return {
        txn_id: t.txn_id,
        user_id: t.user_id,
        user_name: user ? user.name : 'Unknown',
        type: t.type,
        amount: `₹${paisaToRupees(t.amount_paise)}`,
        amount_paise: t.amount_paise.toString(),
        merchant: t.merchant ?? 'N/A',
        description: t.description,
        status: t.status,
        flag_reason: t.flag_reason,
        flagged_at: t.flagged_at ? formatIST(t.flagged_at) : null,
        flagged_by: 'claude-ai',
        transaction_date: formatIST(t.timestamp),
      };
    })
    .sort((a, b) => new Date(b.flagged_at ?? 0).getTime() - new Date(a.flagged_at ?? 0).getTime());

  const highValueUnflagged = transactions
    .filter(t => !t.flagged && Number(t.amount_paise) >= 1000000 && new Date(t.timestamp) >= cutoff)
    .map(t => {
      const user = users.get(t.user_id);
      return {
        txn_id: t.txn_id,
        user_id: t.user_id,
        user_name: user ? user.name : 'Unknown',
        type: t.type,
        amount: `₹${paisaToRupees(t.amount_paise)}`,
        description: t.description,
        transaction_date: formatIST(t.timestamp),
        risk_signal: 'High-value transaction (≥₹10,000)',
      };
    });

  // Apply pagination to flagged list
  const totalFlagged = flagged.length;
  const effectiveLimit = (limit && limit > 0) ? limit : 50;
  const effectiveOffset = offset > 0 ? offset : 0;
  const paginatedFlagged = flagged.slice(effectiveOffset, effectiveOffset + effectiveLimit);

  return {
    flagged_count: totalFlagged,
    flagged_returned: paginatedFlagged.length,
    flagged_transactions: paginatedFlagged,
    review_candidates: {
      count: highValueUnflagged.length,
      description: 'High-value transactions (≥₹10,000) not yet reviewed',
      transactions: highValueUnflagged,
    },
    generated_at: formatIST(now().toISOString()),
  };
}

export function getUserRiskProfile(userId) {
  const user = users.get(userId);
  if (!user) return null;

  const userTxns = transactions.filter(t => t.user_id === userId);
  const limits = KYC_LIMITS[user.kyc_tier] ?? KYC_LIMITS.MINIMUM;

  const flaggedCount = userTxns.filter(t => t.flagged).length;
  const failedCount = userTxns.filter(t => t.status === 'failed').length;
  const highValueTxns = userTxns.filter(t => Number(t.amount_paise) >= 1000000);
  const pendingCount = userTxns.filter(t => t.status === 'pending').length;

  const oneDayAgo = new Date(now()); oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const txns24h = userTxns.filter(t => new Date(t.timestamp) >= oneDayAgo);

  const balanceRatio = Number(user.balance_paise) / limits.max_balance;

  const p2pTxns = userTxns.filter(t => t.type === 'transfer');
  const p2pVolumePaise = p2pTxns.reduce((s, t) => s + Number(t.amount_paise), 0);

  let riskScore = 0;
  const riskFactors = [];

  if (flaggedCount > 0) { riskScore += 30; riskFactors.push(`${flaggedCount} flagged transaction(s)`); }
  if (highValueTxns.length >= 3) { riskScore += 20; riskFactors.push(`${highValueTxns.length} high-value transactions (≥₹10,000)`); }
  else if (highValueTxns.length > 0) { riskScore += 10; riskFactors.push(`${highValueTxns.length} high-value transaction(s)`); }
  if (txns24h.length >= 5) { riskScore += 15; riskFactors.push(`High velocity: ${txns24h.length} transactions in 24h`); }
  if (failedCount >= 3) { riskScore += 10; riskFactors.push(`${failedCount} failed transactions`); }
  if (balanceRatio > 0.8) { riskScore += 10; riskFactors.push(`Balance at ${(balanceRatio * 100).toFixed(0)}% of KYC limit`); }
  if (user.state === 'SUSPENDED') { riskScore += 25; riskFactors.push('Account currently suspended'); }
  if (p2pVolumePaise >= 1000000) { riskScore += 10; riskFactors.push(`High P2P volume: ₹${paisaToRupees(p2pVolumePaise)}`); }

  riskScore = Math.min(riskScore, 100);
  const riskLevel = riskScore >= 60 ? 'HIGH' : riskScore >= 30 ? 'MEDIUM' : 'LOW';

  return {
    user_id: user.user_id,
    name: user.name,
    phone: user.phone,
    status: user.state,
    kyc_tier: user.kyc_tier,
    risk_assessment: {
      risk_score: riskScore,
      risk_level: riskLevel,
      risk_factors: riskFactors.length > 0 ? riskFactors : ['No significant risk signals detected'],
    },
    activity_summary: {
      total_transactions: userTxns.length,
      flagged_transactions: flaggedCount,
      failed_transactions: failedCount,
      pending_transactions: pendingCount,
      high_value_transactions: highValueTxns.length,
      transactions_last_24h: txns24h.length,
    },
    financial_summary: {
      current_balance: `₹${paisaToRupees(user.balance_paise)}`,
      kyc_limit: `₹${paisaToRupees(limits.max_balance)}`,
      balance_utilization: `${(balanceRatio * 100).toFixed(1)}%`,
      p2p_transfer_volume: `₹${paisaToRupees(p2pVolumePaise)}`,
      p2p_transfer_count: p2pTxns.length,
    },
    flagged_details: userTxns.filter(t => t.flagged).map(t => ({
      txn_id: t.txn_id,
      amount: `₹${paisaToRupees(t.amount_paise)}`,
      reason: t.flag_reason,
      flagged_at: t.flagged_at ? formatIST(t.flagged_at) : null,
    })),
    recommendation: riskLevel === 'HIGH'
      ? 'Immediate review recommended. Consider temporary suspension pending investigation.'
      : riskLevel === 'MEDIUM'
        ? 'Monitor closely. Review flagged transactions and high-value activity.'
        : 'No immediate action required. Standard monitoring applies.',
    generated_at: formatIST(now().toISOString()),
  };
}

export function suspendUser(userId, action, reason) {
  const user = users.get(userId);
  if (!user) return null;

  const previousState = user.state;

  if (action === 'suspend') {
    if (user.state === 'SUSPENDED') {
      return { success: false, user_id: userId, name: user.name, message: 'User is already suspended.', current_state: user.state };
    }
    user.state = 'SUSPENDED';
  } else if (action === 'reactivate') {
    if (user.state !== 'SUSPENDED') {
      return { success: false, user_id: userId, name: user.name, message: `Cannot reactivate — user is currently ${user.state}, not SUSPENDED.`, current_state: user.state };
    }
    user.state = 'ACTIVE';
  } else {
    return { success: false, message: `Invalid action: "${action}". Use "suspend" or "reactivate".` };
  }

  return {
    success: true,
    user_id: userId,
    name: user.name,
    phone: user.phone,
    previous_state: previousState,
    new_state: user.state,
    action,
    reason,
    performed_by: 'admin-claude',
    performed_at: formatIST(now().toISOString()),
  };
}

export function getFailedTransactions({ days = 30, include_pending = false, limit, offset = 0 } = {}) {
  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  const statusFilter = include_pending ? ['failed', 'pending'] : ['failed'];

  let failed = transactions
    .filter(t => statusFilter.includes(t.status) && new Date(t.timestamp) >= cutoff)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map(t => {
      const user = users.get(t.user_id);
      return {
        txn_id: t.txn_id,
        user_id: t.user_id,
        user_name: user ? user.name : 'Unknown',
        user_phone: user ? user.phone : 'Unknown',
        type: t.type,
        amount: `₹${paisaToRupees(t.amount_paise)}`,
        amount_paise: t.amount_paise.toString(),
        merchant: t.merchant ?? 'N/A',
        description: t.description,
        status: t.status,
        flagged: t.flagged,
        transaction_date: formatIST(t.timestamp),
      };
    });

  const totalFailedPaise = failed.filter(t => t.status === 'failed').reduce((s, t) => s + Number(t.amount_paise), 0);
  const totalPendingPaise = failed.filter(t => t.status === 'pending').reduce((s, t) => s + Number(t.amount_paise), 0);

  const totalCount = failed.length;
  const effectiveLimit = (limit && limit > 0) ? limit : 50;
  const effectiveOffset = offset > 0 ? offset : 0;
  failed = failed.slice(effectiveOffset, effectiveOffset + effectiveLimit);

  return {
    period: `Last ${days} days`,
    failed_count: transactions.filter(t => t.status === 'failed' && new Date(t.timestamp) >= cutoff).length,
    failed_volume: `₹${paisaToRupees(totalFailedPaise)}`,
    ...(include_pending ? {
      pending_count: transactions.filter(t => t.status === 'pending' && new Date(t.timestamp) >= cutoff).length,
      pending_volume: `₹${paisaToRupees(totalPendingPaise)}`,
    } : {}),
    total_count: totalCount,
    total_returned: failed.length,
    transactions: failed,
    generated_at: formatIST(now().toISOString()),
  };
}
