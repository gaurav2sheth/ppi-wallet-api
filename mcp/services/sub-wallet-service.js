/**
 * Sub-Wallet Service — Corporate Benefits Wallet System
 *
 * Manages purpose-locked sub-wallets (Food, NCMC Transit, FASTag, Gift, Fuel)
 * loaded by employers/issuers for users. All sub-wallet balances count toward
 * the ₹1,00,000 RBI PPI main wallet cap.
 *
 * Functions:
 *   1. getSubWallets(userId)         — list all sub-wallets with balances
 *   2. loadSubWallet(...)            — employer loads a sub-wallet
 *   3. spendFromSubWallet(...)       — spend with cascade logic
 *   4. validateMerchantEligibility() — check merchant → sub-wallet match
 *
 * Usage:
 *   import { getSubWallets, loadSubWallet, spendFromSubWallet, validateMerchantEligibility }
 *     from './sub-wallet-service.js';
 */

import {
  getWalletBalance,
  getSubWalletData,
  updateSubWalletBalance,
  addSubWalletTransaction,
  getEmployerData,
  getUserMainBalancePaise,
  deductMainBalance,
  listAllSubWalletData,
} from '../mock-data.js';

// ── Sub-Wallet Type Definitions ──────────────────────────────────────────────
export const SUB_WALLET_TYPES = {
  FOOD: {
    type: 'FOOD',
    icon: '🍱',
    color: '#F97316',
    label: 'Food',
    monthly_limit_paise: 300000,   // ₹3,000
    eligible_categories: [
      'Restaurants', 'Cafes', 'Food delivery', 'Canteen',
      'Swiggy', 'Zomato', 'Food & Dining',
    ],
    rbi_category: 'Meal voucher equivalent',
  },
  'NCMC TRANSIT': {
    type: 'NCMC TRANSIT',
    icon: '🚇',
    color: '#6366F1',
    label: 'NCMC Transit',
    monthly_limit_paise: 200000,   // ₹2,000
    eligible_categories: [
      'Metro', 'Bus', 'Local train', 'Parking', 'Transit', 'Travel',
    ],
    rbi_category: 'NCMC Transit Card',
  },
  FASTAG: {
    type: 'FASTAG',
    icon: '🛣️',
    color: '#10B981',
    label: 'FASTag',
    monthly_limit_paise: 1000000,  // ₹10,000
    eligible_categories: [
      'NHAI toll plazas', 'FASTag recharge portals', 'Toll', 'FASTag',
    ],
    rbi_category: 'Prepaid transit instrument',
  },
  GIFT: {
    type: 'GIFT',
    icon: '🎁',
    color: '#EC4899',
    label: 'Gift',
    monthly_limit_paise: 0,        // No monthly limit — per occasion
    eligible_categories: [
      'All retail merchants', 'Shopping', 'Food & Dining', 'Entertainment',
      'Groceries', 'Fuel', 'Travel', 'Health', 'Education', 'Utilities',
      'Bill Payment', 'Insurance', 'Other',
    ],
    rbi_category: 'Gift instrument',
  },
  FUEL: {
    type: 'FUEL',
    icon: '⛽',
    color: '#EAB308',
    label: 'Fuel',
    monthly_limit_paise: 250000,   // ₹2,500
    eligible_categories: [
      'HP', 'Indian Oil', 'BPCL', 'Shell', 'Fuel',
      'HP Petrol', 'IOCL', 'Petroleum',
    ],
    rbi_category: 'Petroleum product PPI',
  },
};

// ── RBI PPI Balance Cap ──────────────────────────────────────────────────────
const BALANCE_CAP_PAISE = 10000000; // ₹1,00,000

// ── Helpers ──────────────────────────────────────────────────────────────────
function paiseToRupees(paise) {
  return Math.floor(Number(paise) / 100);
}

function formatINR(paise) {
  return `₹${paiseToRupees(paise).toLocaleString('en-IN')}`;
}

function now() {
  return new Date().toISOString();
}

// ── Function 1: getSubWallets ────────────────────────────────────────────────
/**
 * Returns all sub-wallets for a user with balances, limits, status, and last 5 transactions.
 */
export function getSubWallets(userId) {
  const balanceData = getWalletBalance(userId);
  if (!balanceData) return null;

  const subWallets = getSubWalletData(userId);
  if (!subWallets || subWallets.length === 0) {
    return {
      user_id: userId,
      name: balanceData.name,
      main_balance: balanceData.balance,
      main_balance_paise: balanceData.balance_paise,
      sub_wallets: [],
      total_benefits_balance_paise: '0',
      total_balance_paise: balanceData.balance_paise,
    };
  }

  let totalBenefitsPaise = 0;
  const wallets = subWallets.map(sw => {
    const typeDef = SUB_WALLET_TYPES[sw.type];
    totalBenefitsPaise += Number(sw.balance_paise);

    // Check expiry for GIFT wallets
    let status = sw.status;
    if (sw.type === 'GIFT' && sw.expiry_date && new Date(sw.expiry_date) < new Date()) {
      status = 'EXPIRED';
    }

    // Last 5 transactions
    const recentTxns = (sw.transactions || [])
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    return {
      sub_wallet_id: sw.sub_wallet_id,
      type: sw.type,
      icon: typeDef?.icon || '💳',
      color: typeDef?.color || '#666',
      label: typeDef?.label || sw.type,
      balance: formatINR(sw.balance_paise),
      balance_paise: String(sw.balance_paise),
      currency: 'INR',
      status,
      monthly_limit: typeDef?.monthly_limit_paise ? formatINR(typeDef.monthly_limit_paise) : 'No limit',
      monthly_limit_paise: String(typeDef?.monthly_limit_paise || 0),
      monthly_loaded: formatINR(sw.monthly_loaded_paise || 0),
      monthly_loaded_paise: String(sw.monthly_loaded_paise || 0),
      loaded_by: sw.loaded_by,
      last_loaded_at: sw.last_loaded_at,
      expiry_date: sw.expiry_date,
      eligible_categories: typeDef?.eligible_categories || [],
      rbi_category: typeDef?.rbi_category || '',
      recent_transactions: recentTxns,
    };
  });

  const mainPaise = Number(balanceData.balance_paise);
  return {
    user_id: userId,
    name: balanceData.name,
    main_balance: balanceData.balance,
    main_balance_paise: balanceData.balance_paise,
    sub_wallets: wallets,
    total_benefits_balance: formatINR(totalBenefitsPaise),
    total_benefits_balance_paise: String(totalBenefitsPaise),
    total_balance: formatINR(mainPaise + totalBenefitsPaise),
    total_balance_paise: String(mainPaise + totalBenefitsPaise),
  };
}

// ── Function 2: loadSubWallet ────────────────────────────────────────────────
/**
 * Employer loads a sub-wallet for a user.
 * Validates employer permission, monthly limit, and ₹1L total cap.
 */
export function loadSubWallet(employerId, userId, type, amountPaise, occasion) {
  // Validate sub-wallet type
  const typeDef = SUB_WALLET_TYPES[type];
  if (!typeDef) {
    return { success: false, error: `Invalid sub-wallet type: ${type}` };
  }

  // Validate employer
  const employer = getEmployerData(employerId);
  if (!employer) {
    return { success: false, error: `Employer not found: ${employerId}` };
  }
  if (!employer.allowed_types.includes(type)) {
    return {
      success: false,
      error: `Employer ${employer.name} is not authorized to load ${type} wallets`,
    };
  }

  // Get user data
  const balanceData = getWalletBalance(userId);
  if (!balanceData) {
    return { success: false, error: `User not found: ${userId}` };
  }

  // Get or create sub-wallet
  const subWallets = getSubWalletData(userId);
  let sw = subWallets?.find(s => s.type === type);

  // Check monthly limit (skip for GIFT)
  if (type !== 'GIFT' && typeDef.monthly_limit_paise > 0) {
    const currentLoaded = sw ? Number(sw.monthly_loaded_paise || 0) : 0;
    if (currentLoaded + amountPaise > typeDef.monthly_limit_paise) {
      const remaining = Math.max(0, typeDef.monthly_limit_paise - currentLoaded);
      return {
        success: false,
        error: `Monthly limit exceeded for ${type} wallet. Limit: ${formatINR(typeDef.monthly_limit_paise)}, Already loaded: ${formatINR(currentLoaded)}, Max you can load: ${formatINR(remaining)}`,
        max_allowed_paise: remaining,
      };
    }
  }

  // Check total wallet cap (main + all sub-wallets + new load)
  const mainPaise = Number(balanceData.balance_paise);
  let allSubPaise = 0;
  if (subWallets) {
    for (const s of subWallets) {
      allSubPaise += Number(s.balance_paise);
    }
  }
  const newTotal = mainPaise + allSubPaise + amountPaise;
  if (newTotal > BALANCE_CAP_PAISE) {
    const maxAllowed = Math.max(0, BALANCE_CAP_PAISE - mainPaise - allSubPaise);
    return {
      success: false,
      error: `Loading ${formatINR(amountPaise)} would exceed the ₹1,00,000 wallet cap. Current total: ${formatINR(mainPaise + allSubPaise)}. Max you can load: ${formatINR(maxAllowed)}`,
      blocked_by: 'BALANCE_CAP',
      current_total_paise: mainPaise + allSubPaise,
      max_allowed_paise: maxAllowed,
    };
  }

  // Perform the load
  const subWalletId = `SW-${userId}-${type.replace(/\s+/g, '_')}`;
  const newBalance = (sw ? Number(sw.balance_paise) : 0) + amountPaise;
  const newMonthlyLoaded = (sw ? Number(sw.monthly_loaded_paise || 0) : 0) + amountPaise;

  const expiryDate = type === 'GIFT'
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  updateSubWalletBalance(userId, {
    sub_wallet_id: subWalletId,
    type,
    balance_paise: newBalance,
    monthly_loaded_paise: newMonthlyLoaded,
    loaded_by: employerId,
    last_loaded_at: now(),
    expiry_date: sw?.expiry_date || expiryDate,
    status: 'ACTIVE',
  });

  // Record transaction
  addSubWalletTransaction(userId, type, {
    txn_id: `SWTXN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    amount_paise: amountPaise,
    type: 'credit',
    merchant: employer.name,
    merchant_category: 'Employer Benefit Load',
    description: occasion ? `${type} benefit - ${occasion}` : `${type} benefit load`,
    timestamp: now(),
    status: 'success',
  });

  return {
    success: true,
    sub_wallet_id: subWalletId,
    type,
    loaded_amount: formatINR(amountPaise),
    new_balance: formatINR(newBalance),
    new_balance_paise: newBalance,
    total_wallet_balance: formatINR(mainPaise + allSubPaise + amountPaise),
    total_wallet_balance_paise: mainPaise + allSubPaise + amountPaise,
    occasion: occasion || null,
  };
}

// ── Function 3: spendFromSubWallet ───────────────────────────────────────────
/**
 * Spend from a sub-wallet. Checks eligibility, handles cascade to main wallet.
 */
export function spendFromSubWallet(userId, type, amountPaise, merchant, merchantCategory) {
  const typeDef = SUB_WALLET_TYPES[type];
  if (!typeDef) {
    return { success: false, error: `Invalid sub-wallet type: ${type}` };
  }

  // Check merchant eligibility
  const eligibility = validateMerchantEligibility(merchantCategory, type);
  if (!eligibility.eligible) {
    return {
      success: false,
      error: eligibility.reason,
      suggestion: `This merchant is not eligible for your ${typeDef.label} wallet. Payment will use your main wallet instead.`,
      use_main_wallet: true,
    };
  }

  // Get sub-wallet
  const subWallets = getSubWalletData(userId);
  const sw = subWallets?.find(s => s.type === type);
  if (!sw || sw.status !== 'ACTIVE') {
    return { success: false, error: `No active ${type} sub-wallet found` };
  }

  // Check GIFT expiry
  if (type === 'GIFT' && sw.expiry_date && new Date(sw.expiry_date) < new Date()) {
    return { success: false, error: 'Gift wallet has expired', expired: true };
  }

  const subBalance = Number(sw.balance_paise);
  let fromSub = 0;
  let fromMain = 0;
  let cascadeSpend = false;

  if (subBalance >= amountPaise) {
    // Full spend from sub-wallet
    fromSub = amountPaise;
  } else {
    // Cascade: sub-wallet balance first, remainder from main
    fromSub = subBalance;
    fromMain = amountPaise - subBalance;
    cascadeSpend = true;

    // Check main wallet has enough
    const mainPaise = getUserMainBalancePaise(userId);
    if (mainPaise === null) {
      return { success: false, error: 'User not found' };
    }
    if (mainPaise < fromMain) {
      return {
        success: false,
        error: `Insufficient balance. ${typeDef.label} wallet: ${formatINR(subBalance)}, Main wallet: ${formatINR(mainPaise)}, Total available: ${formatINR(subBalance + mainPaise)}, Required: ${formatINR(amountPaise)}`,
      };
    }

    // Deduct from main wallet
    deductMainBalance(userId, fromMain);
  }

  // Deduct from sub-wallet
  const newSubBalance = subBalance - fromSub;
  updateSubWalletBalance(userId, {
    ...sw,
    balance_paise: newSubBalance,
  });

  // Record transaction
  const txn = {
    txn_id: `SWTXN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    amount_paise: amountPaise,
    type: 'debit',
    merchant,
    merchant_category: merchantCategory,
    description: `${merchant} payment`,
    timestamp: now(),
    status: 'success',
  };
  addSubWalletTransaction(userId, type, txn);

  return {
    success: true,
    total_amount: formatINR(amountPaise),
    from_sub_wallet: formatINR(fromSub),
    from_sub_wallet_paise: fromSub,
    from_main_wallet: formatINR(fromMain),
    from_main_wallet_paise: fromMain,
    cascade_spend: cascadeSpend,
    sub_wallet_new_balance: formatINR(newSubBalance),
    sub_wallet_new_balance_paise: newSubBalance,
    transaction: txn,
  };
}

// ── Function 4: validateMerchantEligibility ──────────────────────────────────
/**
 * Check if a merchant category is eligible for a sub-wallet type.
 */
export function validateMerchantEligibility(merchantCategory, subWalletType) {
  const typeDef = SUB_WALLET_TYPES[subWalletType];
  if (!typeDef) {
    return { eligible: false, reason: `Unknown sub-wallet type: ${subWalletType}` };
  }

  // GIFT wallet accepts all retail merchants
  if (subWalletType === 'GIFT') {
    return {
      eligible: true,
      reason: 'Gift wallet is accepted at all retail merchants',
    };
  }

  // Check if the merchant category matches any eligible category (case-insensitive)
  const normalizedCategory = (merchantCategory || '').toLowerCase();
  const isEligible = typeDef.eligible_categories.some(cat =>
    normalizedCategory.includes(cat.toLowerCase()) || cat.toLowerCase().includes(normalizedCategory)
  );

  if (isEligible) {
    return {
      eligible: true,
      reason: `${merchantCategory} is eligible for ${typeDef.label} wallet`,
    };
  }

  return {
    eligible: false,
    reason: `${merchantCategory} is not eligible for ${typeDef.label} wallet. Eligible categories: ${typeDef.eligible_categories.join(', ')}`,
  };
}

// ── Utility: Get total sub-wallet balance for a user ─────────────────────────
export function getTotalSubWalletBalancePaise(userId) {
  const subWallets = getSubWalletData(userId);
  if (!subWallets) return 0;
  return subWallets.reduce((sum, sw) => sum + Number(sw.balance_paise), 0);
}

// ── Utility: Get utilisation summary across all users ────────────────────────
export function getBenefitsUtilisationSummary() {
  const allData = listAllSubWalletData();

  const summary = {};
  let totalLoaded = 0;
  let totalSpent = 0;
  let expiringThisMonth = 0;

  const nowDate = new Date();
  const monthEnd = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0);

  for (const [userId, subWallets] of allData) {
    for (const sw of subWallets) {
      const type = sw.type;
      if (!summary[type]) {
        summary[type] = { type, loaded: 0, spent: 0, remaining: 0 };
      }

      const balance = Number(sw.balance_paise);
      const loaded = Number(sw.monthly_loaded_paise || 0);
      const txnSpent = (sw.transactions || [])
        .filter(t => t.type === 'debit' && t.status === 'success')
        .reduce((s, t) => s + Number(t.amount_paise), 0);

      summary[type].loaded += loaded;
      summary[type].spent += txnSpent;
      summary[type].remaining += balance;

      totalLoaded += loaded;
      totalSpent += txnSpent;

      // Check GIFT wallet expiry this month
      if (type === 'GIFT' && sw.expiry_date) {
        const expiryDate = new Date(sw.expiry_date);
        if (expiryDate <= monthEnd && expiryDate >= nowDate) {
          expiringThisMonth += balance;
        }
      }
    }
  }

  const typeBreakdown = Object.values(summary).map(s => ({
    type: s.type,
    icon: SUB_WALLET_TYPES[s.type]?.icon || '💳',
    loaded: formatINR(s.loaded),
    loaded_paise: s.loaded,
    spent: formatINR(s.spent),
    spent_paise: s.spent,
    remaining: formatINR(s.remaining),
    remaining_paise: s.remaining,
    utilisation_percent: s.loaded > 0 ? Math.round((s.spent / s.loaded) * 100) : 0,
  }));

  return {
    total_loaded: formatINR(totalLoaded),
    total_loaded_paise: totalLoaded,
    total_spent: formatINR(totalSpent),
    total_spent_paise: totalSpent,
    utilisation_rate: totalLoaded > 0 ? Math.round((totalSpent / totalLoaded) * 100) : 0,
    expiring_this_month: formatINR(expiringThisMonth),
    expiring_this_month_paise: expiringThisMonth,
    by_type: typeBreakdown,
  };
}

