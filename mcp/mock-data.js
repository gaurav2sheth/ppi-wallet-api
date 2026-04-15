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

// ── Seeded PRNG for reproducible generated data ─────────────────────────────
let _seed = 42;
function seededRandom() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
}
function resetSeed(s = 42) { _seed = s; }
function pickRandom(arr) { return arr[Math.floor(seededRandom() * arr.length)]; }
function pickWeighted(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = seededRandom() * total;
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function randomInt(min, max) { return min + Math.floor(seededRandom() * (max - min + 1)); }

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Aditya', 'Akash', 'Amit', 'Ananya', 'Anjali', 'Arjun',
  'Bhavya', 'Chetan', 'Deepak', 'Diya', 'Gaurav', 'Harsh', 'Ishaan', 'Isha',
  'Jayesh', 'Kajal', 'Karan', 'Kavya', 'Kriti', 'Lakshmi', 'Manish', 'Meera',
  'Mohit', 'Neha', 'Nikhil', 'Nisha', 'Pallavi', 'Pooja', 'Priya', 'Rahul',
  'Rajesh', 'Ravi', 'Ritika', 'Rohit', 'Sakshi', 'Sandeep', 'Sanjay', 'Shreya',
  'Simran', 'Sneha', 'Srishti', 'Sunil', 'Tanvi', 'Varun', 'Vidya', 'Vikram',
  'Vivek', 'Yash',
];
const LAST_NAMES = [
  'Agarwal', 'Bansal', 'Choudhary', 'Desai', 'Dubey', 'Gupta', 'Iyer', 'Jain',
  'Joshi', 'Kapoor', 'Khan', 'Kumar', 'Malhotra', 'Mehta', 'Mishra', 'Nair',
  'Pandey', 'Patel', 'Rao', 'Reddy', 'Saxena', 'Shah', 'Sharma', 'Singh',
  'Sinha', 'Srivastava', 'Thakur', 'Tiwari', 'Verma', 'Yadav',
];
const PHONE_PREFIXES = ['98', '97', '96', '95', '94', '93', '91', '90', '88', '87', '86', '85', '70', '76', '77', '78', '79'];
const GEN_MERCHANTS = [
  'Swiggy', 'Zomato', 'Uber', 'Ola', 'BigBasket', 'Blinkit', 'Amazon', 'Flipkart',
  'Myntra', 'D-Mart', 'Reliance Fresh', 'PVR Cinemas', 'BookMyShow', 'MakeMyTrip',
  'Rapido', 'PharmEasy', '1mg', 'Udemy', 'BESCOM', 'Jio', 'Airtel', 'Vi',
  'Tata Play', 'Netflix', 'Hotstar', 'HP Petrol', 'IOCL', 'Shell', 'Bajaj Finserv',
  'HDFC Life', 'ICICI Lombard', 'Star Health', 'Starbucks', 'Dominos', 'McDonalds',
  'Croma', 'Nykaa', 'Apollo Pharmacy', 'Decathlon', 'IRCTC',
];
function genName() { return `${pickRandom(FIRST_NAMES)} ${pickRandom(LAST_NAMES)}`; }
function genPhone() {
  const prefix = pickRandom(PHONE_PREFIXES);
  let rest = '';
  for (let i = 0; i < 8; i++) rest += String(randomInt(0, 9));
  return `+91-${prefix}${rest}`;
}

// ── KYC States: UNVERIFIED → MIN_KYC → FULL_KYC_PENDING → FULL_KYC / REJECTED / SUSPENDED
// kyc_tier is the RBI classification (MINIMUM/FULL), kyc_state is the verification workflow state

// ── 10 Wallet Users ──────────────────────────────────────────────────────────
const users = new Map([
  ['user_001', {
    user_id: 'user_001',
    name: 'Gaurav Sheth',
    phone: '+91-9876543210',
    balance_paise: 23611n,     // ₹236.11 (matches wallet app)
    held_paise: 0n,
    kyc_tier: 'FULL',
    kyc_state: 'FULL_KYC',
    aadhaar_verified: true,
    pan_masked: 'ABCDE****F',
    ckyc_number: 'CKYC-12345678',
    wallet_expiry_date: null,   // FULL KYC — no expiry
    rejected_reason: null,
    monthly_p2p_mtd_paise: 150000n,   // ₹1,500 P2P this month
    annual_load_ytd_paise: 2500000n,  // ₹25,000 loaded this year
    state: 'ACTIVE',
    created_at: daysAgo(90),
    last_activity_at: daysAgo(0),
  }],
  ['user_002', {
    user_id: 'user_002',
    name: 'Priya Sharma',
    phone: '+91-9988776655',
    balance_paise: 875050n,    // ₹8,750.50
    held_paise: 50000n,        // ₹500 held
    kyc_tier: 'FULL',
    kyc_state: 'FULL_KYC',
    aadhaar_verified: true,
    pan_masked: 'BCDEG****H',
    ckyc_number: 'CKYC-23456789',
    wallet_expiry_date: null,
    rejected_reason: null,
    monthly_p2p_mtd_paise: 250000n,
    annual_load_ytd_paise: 1800000n,
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
    kyc_state: 'MIN_KYC',
    aadhaar_verified: false,
    pan_masked: null,
    ckyc_number: null,
    wallet_expiry_date: daysAgo(-305),  // expires 305 days from now (created 60d ago, 365d expiry)
    rejected_reason: null,
    monthly_p2p_mtd_paise: 80000n,
    annual_load_ytd_paise: 500000n,
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
    kyc_state: 'FULL_KYC',
    aadhaar_verified: true,
    pan_masked: 'DEFGH****J',
    ckyc_number: 'CKYC-34567890',
    wallet_expiry_date: null,
    rejected_reason: null,
    monthly_p2p_mtd_paise: 1200000n,
    annual_load_ytd_paise: 8000000n,
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
    kyc_state: 'SUSPENDED',
    aadhaar_verified: false,
    pan_masked: null,
    ckyc_number: null,
    wallet_expiry_date: daysAgo(-320),
    rejected_reason: 'KYC non-compliance — failed to complete Full KYC within stipulated time',
    monthly_p2p_mtd_paise: 0n,
    annual_load_ytd_paise: 100000n,
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
    kyc_state: 'FULL_KYC',
    aadhaar_verified: true,
    pan_masked: 'EFGHJ****K',
    ckyc_number: 'CKYC-45678901',
    wallet_expiry_date: null,
    rejected_reason: null,
    monthly_p2p_mtd_paise: 0n,
    annual_load_ytd_paise: 3500000n,
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
    kyc_state: 'FULL_KYC_PENDING',
    aadhaar_verified: true,
    pan_masked: 'FGHJK****L',
    ckyc_number: null,         // Pending — not yet assigned
    wallet_expiry_date: daysAgo(-335),
    rejected_reason: null,
    monthly_p2p_mtd_paise: 50000n,
    annual_load_ytd_paise: 200000n,
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
    kyc_state: 'FULL_KYC',
    aadhaar_verified: true,
    pan_masked: 'GHJKL****M',
    ckyc_number: 'CKYC-56789012',
    wallet_expiry_date: null,
    rejected_reason: null,
    monthly_p2p_mtd_paise: 500000n,
    annual_load_ytd_paise: 6000000n,
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
    kyc_state: 'FULL_KYC',
    aadhaar_verified: true,
    pan_masked: 'HJKLM****N',
    ckyc_number: 'CKYC-67890123',
    wallet_expiry_date: null,
    rejected_reason: null,
    monthly_p2p_mtd_paise: 0n,
    annual_load_ytd_paise: 0n,
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
    kyc_state: 'REJECTED',
    aadhaar_verified: false,
    pan_masked: 'JKLMN****P',
    ckyc_number: null,
    wallet_expiry_date: daysAgo(-290),
    rejected_reason: 'Document mismatch — Aadhaar photo does not match video KYC',
    monthly_p2p_mtd_paise: 30000n,
    annual_load_ytd_paise: 400000n,
    state: 'ACTIVE',
    created_at: daysAgo(75),
    last_activity_at: daysAgo(2),
  }],
]);

// ── Generate 190 additional users for consistency with admin dashboard ────────
(function generateAdditionalUsers() {
  resetSeed(100); // Same seed as admin dashboard
  for (let i = 11; i <= 200; i++) {
    const userId = `user_${String(i).padStart(3, '0')}`;
    const name = genName();
    const phone = genPhone();

    const kycTier = pickWeighted(['FULL', 'MINIMUM'], [40, 60]);
    const kycState = pickWeighted(
      ['FULL_KYC', 'MIN_KYC', 'FULL_KYC_PENDING', 'REJECTED', 'UNVERIFIED', 'SUSPENDED'],
      [35, 40, 10, 5, 7, 3]
    );
    const walletState = pickWeighted(
      ['ACTIVE', 'DORMANT', 'SUSPENDED', 'EXPIRED', 'CLOSED'],
      [75, 10, 5, 5, 5]
    );

    const maxBalance = kycTier === 'FULL' ? 20000000 : 1000000;
    const balancePaise = BigInt(randomInt(0, maxBalance));
    const heldPaise = BigInt(randomInt(0, Math.min(50000, Number(balancePaise) / 2)));

    const accountAgeDays = randomInt(7, 365);
    const isActive = walletState === 'ACTIVE';
    const lastActivityDays = isActive ? randomInt(0, 30) : walletState === 'DORMANT' ? randomInt(60, 180) : randomInt(30, 90);

    const aadhaarVerified = kycState === 'FULL_KYC' || kycState === 'FULL_KYC_PENDING' || (kycState === 'MIN_KYC' && seededRandom() > 0.5);
    const panMasked = (kycState === 'FULL_KYC' || (kycState === 'MIN_KYC' && seededRandom() > 0.6))
      ? `${pickRandom('ABCDEFGHJ'.split(''))}${pickRandom('BCDEFGHJK'.split(''))}${pickRandom('CDEFGHJKL'.split(''))}${pickRandom('DEFGHJKLM'.split(''))}${pickRandom('EFGHJKLMN'.split(''))}****${pickRandom('FGHJKLMNP'.split(''))}`
      : null;
    const ckycNumber = kycState === 'FULL_KYC' ? `CKYC-${randomInt(10000000, 99999999)}` : null;

    const walletExpiryDate = kycTier === 'MINIMUM' ? daysAgo(-(365 - accountAgeDays)) : null;
    const rejectedReason = kycState === 'REJECTED'
      ? pickRandom(['Document mismatch', 'Blurry Aadhaar photo', 'Name mismatch with records', 'Invalid date of birth', 'Duplicate account detected'])
      : kycState === 'SUSPENDED' ? 'KYC non-compliance' : null;

    users.set(userId, {
      user_id: userId,
      name,
      phone,
      balance_paise: balancePaise,
      held_paise: heldPaise,
      kyc_tier: kycTier,
      kyc_state: kycState,
      aadhaar_verified: aadhaarVerified,
      pan_masked: panMasked,
      ckyc_number: ckycNumber,
      wallet_expiry_date: walletExpiryDate,
      rejected_reason: rejectedReason,
      monthly_p2p_mtd_paise: BigInt(randomInt(0, kycTier === 'FULL' ? 500000 : 100000)),
      annual_load_ytd_paise: BigInt(randomInt(0, kycTier === 'FULL' ? 5000000 : 500000)),
      state: walletState,
      created_at: daysAgo(accountAgeDays),
      last_activity_at: daysAgo(lastActivityDays),
    });
  }
})();

// ── KYC Expiry Test Users (override generated users for KYC Upgrade Agent testing) ──
// These 5 users have MIN_KYC expiring within 7 days with varying profiles.
// queryKycExpiry calculates expiry as created_at + 365 days, so created_at = daysAgo(365 - N)
// for N days until expiry.

// P1: KYC expiring in 1 day, high balance, DORMANT (0 txns in 30 days) → urgent escalation + SMS
users.set('user_196', {
  user_id: 'user_196',
  name: 'Kavita Thakur',
  phone: '+91-9871234501',
  balance_paise: 4800000n,    // ₹48,000.00
  held_paise: 0n,
  kyc_tier: 'MINIMUM',
  kyc_state: 'MIN_KYC',
  aadhaar_verified: false,
  pan_masked: null,
  ckyc_number: null,
  wallet_expiry_date: daysAgo(-1),
  rejected_reason: null,
  monthly_p2p_mtd_paise: 0n,
  annual_load_ytd_paise: 850000n,
  state: 'DORMANT',
  created_at: daysAgo(364),   // expires in 1 day
  last_activity_at: daysAgo(45),
});

// P2: KYC expiring in 3 days, medium balance, HIGH activity (>10 txns) → standard outreach + cashback
users.set('user_197', {
  user_id: 'user_197',
  name: 'Nikhil Bansal',
  phone: '+91-9871234502',
  balance_paise: 1200000n,    // ₹12,000.00
  held_paise: 25000n,         // ₹250 held
  kyc_tier: 'MINIMUM',
  kyc_state: 'MIN_KYC',
  aadhaar_verified: false,
  pan_masked: null,
  ckyc_number: null,
  wallet_expiry_date: daysAgo(-3),
  rejected_reason: null,
  monthly_p2p_mtd_paise: 60000n,
  annual_load_ytd_paise: 600000n,
  state: 'ACTIVE',
  created_at: daysAgo(362),   // expires in 3 days
  last_activity_at: daysAgo(0),
});

// P3: KYC expiring in 5 days, low-medium balance, MEDIUM activity → gentle reminder
users.set('user_198', {
  user_id: 'user_198',
  name: 'Simran Kapoor',
  phone: '+91-9871234503',
  balance_paise: 350000n,     // ₹3,500.00
  held_paise: 0n,
  kyc_tier: 'MINIMUM',
  kyc_state: 'MIN_KYC',
  aadhaar_verified: false,
  pan_masked: null,
  ckyc_number: null,
  wallet_expiry_date: daysAgo(-5),
  rejected_reason: null,
  monthly_p2p_mtd_paise: 20000n,
  annual_load_ytd_paise: 300000n,
  state: 'ACTIVE',
  created_at: daysAgo(360),   // expires in 5 days
  last_activity_at: daysAgo(3),
});

// P4: KYC expiring in 7 days, very low balance, DORMANT → monitor only
users.set('user_199', {
  user_id: 'user_199',
  name: 'Rajesh Yadav',
  phone: '+91-9871234504',
  balance_paise: 35000n,      // ₹350.00
  held_paise: 0n,
  kyc_tier: 'MINIMUM',
  kyc_state: 'MIN_KYC',
  aadhaar_verified: false,
  pan_masked: null,
  ckyc_number: null,
  wallet_expiry_date: daysAgo(-7),
  rejected_reason: null,
  monthly_p2p_mtd_paise: 0n,
  annual_load_ytd_paise: 50000n,
  state: 'DORMANT',
  created_at: daysAgo(358),   // expires in 7 days
  last_activity_at: daysAgo(60),
});

// P5: KYC expiring in 2 days, moderate balance, ACTIVE, already submitted upgrade → FULL_KYC_PENDING
users.set('user_200', {
  user_id: 'user_200',
  name: 'Diya Mishra',
  phone: '+91-9871234505',
  balance_paise: 750000n,     // ₹7,500.00
  held_paise: 0n,
  kyc_tier: 'MINIMUM',
  kyc_state: 'FULL_KYC_PENDING',
  aadhaar_verified: true,
  pan_masked: 'ABCDE****G',
  ckyc_number: null,
  wallet_expiry_date: daysAgo(-2),
  rejected_reason: null,
  monthly_p2p_mtd_paise: 40000n,
  annual_load_ytd_paise: 400000n,
  state: 'ACTIVE',
  created_at: daysAgo(363),   // expires in 2 days
  last_activity_at: daysAgo(1),
});

// ── 40 Transactions across users and last 90 days ────────────────────────────
const transactions = [
  // user_001 (Gaurav Sheth) — 11 transactions matching wallet app seed data
  { txn_id: 'txn_001', user_id: 'user_001', type: 'pay', amount_paise: 6500n, merchant: 'Uber', description: 'Uber Ride', timestamp: daysAgo(0), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_002', user_id: 'user_001', type: 'transfer', amount_paise: 6700n, merchant: null, description: 'P2P transfer to Deviprasad Shukla', timestamp: daysAgo(0), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_003', user_id: 'user_001', type: 'pay', amount_paise: 4500n, merchant: 'Swiggy', description: 'Swiggy Order', timestamp: daysAgo(1), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_004', user_id: 'user_001', type: 'pay', amount_paise: 90000n, merchant: 'Shankari Restaurant', description: 'Shankari Restaurant', timestamp: daysAgo(1), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_005', user_id: 'user_001', type: 'load', amount_paise: 545000n, merchant: null, description: 'P2P from Siddhartha Guha', timestamp: daysAgo(2), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_006', user_id: 'user_001', type: 'pay', amount_paise: 3100n, merchant: 'Tea Stall', description: 'Tea Stall', timestamp: daysAgo(3), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_042', user_id: 'user_001', type: 'load', amount_paise: 200000n, merchant: null, description: 'Wallet Top-up via UPI - HDFC Bank', timestamp: daysAgo(5), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_043', user_id: 'user_001', type: 'pay', amount_paise: 76651n, merchant: 'Uber', description: 'Uber Trip', timestamp: daysAgo(7), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_044', user_id: 'user_001', type: 'load', amount_paise: 76651n, merchant: null, description: 'Uber Refund', timestamp: daysAgo(7), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_045', user_id: 'user_001', type: 'pay', amount_paise: 50000n, merchant: 'MSEB', description: 'Electricity Bill - MSEB', timestamp: daysAgo(10), status: 'success', flagged: false, flag_reason: null, flagged_at: null },
  { txn_id: 'txn_046', user_id: 'user_001', type: 'load', amount_paise: 500000n, merchant: null, description: 'Wallet Top-up via Debit Card', timestamp: daysAgo(15), status: 'success', flagged: false, flag_reason: null, flagged_at: null },

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

// ── Generate ~500 additional transactions for generated users ─────────────────
(function generateAdditionalTransactions() {
  resetSeed(200); // Same seed as admin dashboard
  let txnCounter = 100;

  // Generate 2-5 transactions per generated user (users 11-200)
  for (let i = 11; i <= 200; i++) {
    const userId = `user_${String(i).padStart(3, '0')}`;
    const user = users.get(userId);
    if (!user || user.state === 'CLOSED' || user.state === 'EXPIRED') continue;

    const txnCount = randomInt(2, 5);
    for (let j = 0; j < txnCount; j++) {
      const type = pickWeighted(['pay', 'load', 'transfer'], [50, 30, 20]);
      const merchant = type === 'pay' ? pickRandom(GEN_MERCHANTS) : null;

      const amountRange = type === 'load' ? [10000, 500000]
        : type === 'pay' ? [2000, 500000]
        : [5000, 200000];
      const amountPaise = BigInt(randomInt(amountRange[0], amountRange[1]));

      const status = pickWeighted(['success', 'success', 'success', 'failed', 'pending'], [40, 30, 15, 10, 5]);
      const dayOffset = randomInt(0, 89);

      const description = type === 'load'
        ? pickRandom(['Wallet top-up via UPI', 'Wallet top-up via NEFT', 'Wallet top-up via Debit Card', `P2P from ${genName()}`])
        : type === 'transfer'
          ? `P2P transfer to ${genName()}`
          : `${merchant}${pickRandom([' - Order', ' Payment', '', ' Purchase', ' - Bill'])}`;

      const txnId = `txn_${String(txnCounter++).padStart(3, '0')}`;
      transactions.push({
        txn_id: txnId,
        user_id: userId,
        type,
        amount_paise: amountPaise,
        merchant,
        description,
        timestamp: daysAgo(dayOffset),
        status,
        flagged: seededRandom() < 0.02, // 2% flagged
        flag_reason: null,
        flagged_at: null,
      });
    }
  }

  // Flag the randomly flagged transactions with reasons
  for (const t of transactions) {
    if (t.flagged && !t.flag_reason) {
      t.flag_reason = pickRandom([
        'High-value transaction — exceeds normal pattern',
        'Velocity alert — multiple transactions in short period',
        'Suspicious merchant pattern',
        'Amount exceeds RBI PPI limit threshold',
        'New merchant with unusually large payment',
      ]);
      t.flagged_at = now().toISOString();
    }
  }
})();

// ── Disputes ─────────────────────────────────────────────────────────────────
let nextDisputeId = 1;
const disputes = [
  { dispute_id: 'DSP-001', user_id: 'user_002', txn_id: 'txn_011', type: 'failed_transaction', description: 'Zomato payment failed but amount deducted', status: 'open', created_at: daysAgo(5), resolved_at: null, resolution: null },
  { dispute_id: 'DSP-002', user_id: 'user_004', txn_id: 'txn_017', type: 'unauthorized', description: 'Did not authorize this P2P transfer', status: 'under_review', created_at: daysAgo(10), resolved_at: null, resolution: null },
  { dispute_id: 'DSP-003', user_id: 'user_003', txn_id: 'txn_015', type: 'failed_transaction', description: 'P2P transfer to Vikram failed, money not returned', status: 'resolved', created_at: daysAgo(12), resolved_at: daysAgo(8), resolution: 'Amount refunded to wallet' },
];
nextDisputeId = 4;

// ── Refunds ──────────────────────────────────────────────────────────────────
let nextRefundId = 1;
const refunds = [
  { refund_id: 'RFD-001', user_id: 'user_001', txn_id: 'txn_043', amount_paise: 76651n, reason: 'Uber ride cancelled', status: 'completed', created_at: daysAgo(7), completed_at: daysAgo(7) },
  { refund_id: 'RFD-002', user_id: 'user_003', txn_id: 'txn_015', amount_paise: 300000n, reason: 'Failed P2P — auto refund', status: 'completed', created_at: daysAgo(12), completed_at: daysAgo(8) },
  { refund_id: 'RFD-003', user_id: 'user_002', txn_id: 'txn_011', amount_paise: 75000n, reason: 'Zomato order failed', status: 'pending', created_at: daysAgo(5), completed_at: null },
];
nextRefundId = 4;

// ── Notifications ────────────────────────────────────────────────────────────
let nextNotifId = 1;
const notifications = [
  { notif_id: 'NTF-001', user_id: 'user_001', type: 'transaction', title: 'Payment Successful', message: 'Paid ₹65.00 to Uber', read: false, created_at: daysAgo(0) },
  { notif_id: 'NTF-002', user_id: 'user_001', type: 'transaction', title: 'Money Received', message: 'Received ₹5,450.00 from Siddhartha Guha', read: false, created_at: daysAgo(2) },
  { notif_id: 'NTF-003', user_id: 'user_001', type: 'low_balance', title: 'Low Balance Alert', message: 'Your wallet balance is below ₹500. Top up now!', read: true, created_at: daysAgo(3) },
  { notif_id: 'NTF-004', user_id: 'user_002', type: 'transaction', title: 'Payment Failed', message: 'Zomato payment of ₹750.00 failed', read: false, created_at: daysAgo(12) },
  { notif_id: 'NTF-005', user_id: 'user_005', type: 'account', title: 'Account Suspended', message: 'Your account has been suspended due to KYC non-compliance', read: true, created_at: daysAgo(30) },
  { notif_id: 'NTF-006', user_id: 'user_007', type: 'kyc', title: 'KYC Upgrade Pending', message: 'Your Full KYC verification is under review', read: false, created_at: daysAgo(3) },
  { notif_id: 'NTF-007', user_id: 'user_001', type: 'promotion', title: 'Cashback Offer', message: 'Get 10% cashback on your next 3 transactions', read: false, created_at: daysAgo(1) },
];
nextNotifId = 8;

// ── Alert Thresholds ─────────────────────────────────────────────────────────
const alertThresholds = new Map([
  ['user_001', { low_balance: 50000, high_transaction: 500000, daily_spend: 1000000 }],
  ['user_002', { low_balance: 100000, high_transaction: 1000000, daily_spend: 2000000 }],
]);

// ── Employer Data ───────────────────────────────────────────────────────────
const employers = new Map([
  ['employer_001', {
    employer_id: 'employer_001',
    name: 'Paytm',
    allowed_types: ['FOOD', 'NCMC TRANSIT', 'FUEL'],
  }],
  ['employer_002', {
    employer_id: 'employer_002',
    name: 'TCS',
    allowed_types: ['FOOD', 'NCMC TRANSIT', 'FASTAG', 'GIFT', 'FUEL'],
  }],
]);

// ── Sub-Wallet Data ─────────────────────────────────────────────────────────
// Map<userId, sub-wallet[]>
const subWalletStore = new Map();

function daysAgoISO(n) {
  const d = new Date(MODULE_LOAD_TIME);
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function daysFromNowISO(n) {
  const d = new Date(MODULE_LOAD_TIME);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

// Seed sub-wallet data for user_001 (Gaurav Sheth)
subWalletStore.set('user_001', [
  {
    sub_wallet_id: 'SW-user_001-FOOD',
    type: 'FOOD',
    balance_paise: 120000,
    status: 'ACTIVE',
    monthly_loaded_paise: 300000,
    loaded_by: 'employer_001',
    last_loaded_at: daysAgoISO(2),
    expiry_date: null,
    transactions: [
      { txn_id: 'SWTXN-F001', amount_paise: 35000, type: 'debit', merchant: 'Swiggy', merchant_category: 'Food & Dining', description: 'Swiggy lunch order', timestamp: daysAgoISO(0), status: 'success' },
      { txn_id: 'SWTXN-F002', amount_paise: 25000, type: 'debit', merchant: 'Zomato', merchant_category: 'Food & Dining', description: 'Zomato dinner order', timestamp: daysAgoISO(1), status: 'success' },
      { txn_id: 'SWTXN-F003', amount_paise: 8000, type: 'debit', merchant: 'Starbucks', merchant_category: 'Food & Dining', description: 'Starbucks coffee', timestamp: daysAgoISO(2), status: 'success' },
      { txn_id: 'SWTXN-F004', amount_paise: 12000, type: 'debit', merchant: 'Dominos', merchant_category: 'Food & Dining', description: 'Dominos pizza', timestamp: daysAgoISO(3), status: 'success' },
      { txn_id: 'SWTXN-F005', amount_paise: 300000, type: 'credit', merchant: 'Paytm', merchant_category: 'Employer Benefit Load', description: 'FOOD benefit - Monthly Benefits', timestamp: daysAgoISO(5), status: 'success' },
    ],
  },
  {
    sub_wallet_id: 'SW-user_001-NCMC_TRANSIT',
    type: 'NCMC TRANSIT',
    balance_paise: 80000,
    status: 'ACTIVE',
    monthly_loaded_paise: 200000,
    loaded_by: 'employer_001',
    last_loaded_at: daysAgoISO(5),
    expiry_date: null,
    transactions: [
      { txn_id: 'SWTXN-T001', amount_paise: 6000, type: 'debit', merchant: 'Mumbai Metro', merchant_category: 'Transit', description: 'Metro ride - Andheri to BKC', timestamp: daysAgoISO(0), status: 'success' },
      { txn_id: 'SWTXN-T002', amount_paise: 4000, type: 'debit', merchant: 'BEST Bus', merchant_category: 'Transit', description: 'Bus ticket', timestamp: daysAgoISO(1), status: 'success' },
      { txn_id: 'SWTXN-T003', amount_paise: 10000, type: 'debit', merchant: 'Mumbai Metro', merchant_category: 'Transit', description: 'Metro monthly pass', timestamp: daysAgoISO(3), status: 'success' },
      { txn_id: 'SWTXN-T004', amount_paise: 200000, type: 'credit', merchant: 'Paytm', merchant_category: 'Employer Benefit Load', description: 'NCMC TRANSIT benefit - Monthly Benefits', timestamp: daysAgoISO(5), status: 'success' },
    ],
  },
  {
    sub_wallet_id: 'SW-user_001-FASTAG',
    type: 'FASTAG',
    balance_paise: 50000,
    status: 'ACTIVE',
    monthly_loaded_paise: 100000,
    loaded_by: 'employer_001',
    last_loaded_at: daysAgoISO(10),
    expiry_date: null,
    transactions: [
      { txn_id: 'SWTXN-FT01', amount_paise: 15000, type: 'debit', merchant: 'NHAI Toll', merchant_category: 'Toll', description: 'Mumbai-Pune Expressway toll', timestamp: daysAgoISO(1), status: 'success' },
      { txn_id: 'SWTXN-FT02', amount_paise: 10000, type: 'debit', merchant: 'NHAI Toll', merchant_category: 'Toll', description: 'Bandra-Worli Sea Link toll', timestamp: daysAgoISO(4), status: 'success' },
      { txn_id: 'SWTXN-FT03', amount_paise: 100000, type: 'credit', merchant: 'Paytm', merchant_category: 'Employer Benefit Load', description: 'FASTAG benefit load', timestamp: daysAgoISO(10), status: 'success' },
    ],
  },
  {
    sub_wallet_id: 'SW-user_001-GIFT',
    type: 'GIFT',
    balance_paise: 200000,
    status: 'ACTIVE',
    monthly_loaded_paise: 0,
    loaded_by: 'employer_001',
    last_loaded_at: daysAgoISO(30),
    expiry_date: daysFromNowISO(335),
    transactions: [
      { txn_id: 'SWTXN-G001', amount_paise: 200000, type: 'credit', merchant: 'Paytm', merchant_category: 'Employer Benefit Load', description: 'GIFT benefit - Diwali Bonus', timestamp: daysAgoISO(30), status: 'success' },
    ],
  },
  {
    sub_wallet_id: 'SW-user_001-FUEL',
    type: 'FUEL',
    balance_paise: 150000,
    status: 'ACTIVE',
    monthly_loaded_paise: 250000,
    loaded_by: 'employer_001',
    last_loaded_at: daysAgoISO(3),
    expiry_date: null,
    transactions: [
      { txn_id: 'SWTXN-FL01', amount_paise: 50000, type: 'debit', merchant: 'HP Petrol', merchant_category: 'Fuel', description: 'HP Petrol - Fuel refill', timestamp: daysAgoISO(0), status: 'success' },
      { txn_id: 'SWTXN-FL02', amount_paise: 35000, type: 'debit', merchant: 'IOCL', merchant_category: 'Fuel', description: 'Indian Oil - Diesel', timestamp: daysAgoISO(2), status: 'success' },
      { txn_id: 'SWTXN-FL03', amount_paise: 250000, type: 'credit', merchant: 'Paytm', merchant_category: 'Employer Benefit Load', description: 'FUEL benefit - Monthly Benefits', timestamp: daysAgoISO(3), status: 'success' },
    ],
  },
]);

// Generate sub-wallets for users 2-200 with varied data
(function generateSubWallets() {
  resetSeed(500);

  const swTypes = ['FOOD', 'NCMC TRANSIT', 'FASTAG', 'GIFT', 'FUEL'];
  const swMerchants = {
    FOOD: [
      { name: 'Swiggy', cat: 'Food & Dining' }, { name: 'Zomato', cat: 'Food & Dining' },
      { name: 'Starbucks', cat: 'Food & Dining' }, { name: 'Dominos', cat: 'Food & Dining' },
      { name: 'McDonalds', cat: 'Food & Dining' },
    ],
    'NCMC TRANSIT': [
      { name: 'Mumbai Metro', cat: 'Transit' }, { name: 'Delhi Metro', cat: 'Transit' },
      { name: 'BEST Bus', cat: 'Transit' }, { name: 'Local Train', cat: 'Transit' },
    ],
    FASTAG: [
      { name: 'NHAI Toll', cat: 'Toll' }, { name: 'FASTag Recharge', cat: 'FASTag' },
    ],
    GIFT: [
      { name: 'Amazon', cat: 'Shopping' }, { name: 'Flipkart', cat: 'Shopping' },
      { name: 'Myntra', cat: 'Shopping' }, { name: 'Swiggy', cat: 'Food & Dining' },
    ],
    FUEL: [
      { name: 'HP Petrol', cat: 'Fuel' }, { name: 'IOCL', cat: 'Fuel' },
      { name: 'BPCL', cat: 'Fuel' }, { name: 'Shell', cat: 'Fuel' },
    ],
  };

  const maxBalances = {
    FOOD: 300000, 'NCMC TRANSIT': 200000, FASTAG: 1000000, GIFT: 500000, FUEL: 250000,
  };
  const monthlyLimits = {
    FOOD: 300000, 'NCMC TRANSIT': 200000, FASTAG: 1000000, GIFT: 0, FUEL: 250000,
  };

  for (let i = 2; i <= 200; i++) {
    const userId = `user_${String(i).padStart(3, '0')}`;
    const user = users.get(userId);
    if (!user || user.state !== 'ACTIVE') continue;

    // Each user gets 2-5 random sub-wallet types
    const numTypes = randomInt(2, 5);
    const shuffled = [...swTypes].sort(() => seededRandom() - 0.5);
    const selectedTypes = shuffled.slice(0, numTypes);
    const empId = seededRandom() > 0.5 ? 'employer_001' : 'employer_002';

    const userSubWallets = [];
    for (const swType of selectedTypes) {
      const employer = employers.get(empId);
      if (!employer?.allowed_types.includes(swType)) continue;

      const maxBal = maxBalances[swType];
      const balance = randomInt(0, maxBal);
      const monthlyLoaded = monthlyLimits[swType] > 0
        ? randomInt(0, monthlyLimits[swType])
        : (swType === 'GIFT' ? randomInt(100000, 500000) : 0);

      // Generate 3-8 transactions per sub-wallet
      const txnCount = randomInt(3, 8);
      const merchantList = swMerchants[swType];
      const txns = [];

      // Always add the credit (load) transaction
      txns.push({
        txn_id: `SWTXN-${userId}-${swType.charAt(0)}${randomInt(1000, 9999)}`,
        amount_paise: monthlyLoaded || balance + randomInt(10000, 100000),
        type: 'credit',
        merchant: employer.name,
        merchant_category: 'Employer Benefit Load',
        description: `${swType} benefit${swType === 'GIFT' ? ' - Diwali Bonus' : ' - Monthly Benefits'}`,
        timestamp: daysAgoISO(randomInt(2, 15)),
        status: 'success',
      });

      // Add debit transactions
      for (let t = 1; t < txnCount; t++) {
        const m = pickRandom(merchantList);
        txns.push({
          txn_id: `SWTXN-${userId}-${swType.charAt(0)}${randomInt(1000, 9999)}`,
          amount_paise: randomInt(2000, Math.min(50000, maxBal / 3)),
          type: 'debit',
          merchant: m.name,
          merchant_category: m.cat,
          description: `${m.name} payment`,
          timestamp: daysAgoISO(randomInt(0, 20)),
          status: pickWeighted(['success', 'success', 'failed'], [45, 45, 10]),
        });
      }

      userSubWallets.push({
        sub_wallet_id: `SW-${userId}-${swType.replace(/\s+/g, '_')}`,
        type: swType,
        balance_paise: balance,
        status: 'ACTIVE',
        monthly_loaded_paise: monthlyLoaded,
        loaded_by: empId,
        last_loaded_at: daysAgoISO(randomInt(1, 15)),
        expiry_date: swType === 'GIFT' ? daysFromNowISO(randomInt(30, 365)) : null,
        transactions: txns,
      });
    }

    if (userSubWallets.length > 0) {
      subWalletStore.set(userId, userSubWallets);
    }
  }
})();

// ── Sub-Wallet Data Access Functions ────────────────────────────────────────
export function getSubWalletData(userId) {
  return subWalletStore.get(userId) || [];
}

export function getEmployerData(employerId) {
  return employers.get(employerId) || null;
}

export function getUserMainBalancePaise(userId) {
  const user = users.get(userId);
  if (!user) return null;
  return Number(user.balance_paise);
}

export function deductMainBalance(userId, amountPaise) {
  const user = users.get(userId);
  if (!user) return false;
  user.balance_paise = BigInt(Number(user.balance_paise) - amountPaise);
  return true;
}

export function updateSubWalletBalance(userId, updatedSw) {
  let sws = subWalletStore.get(userId);
  if (!sws) {
    sws = [];
    subWalletStore.set(userId, sws);
  }

  const idx = sws.findIndex(s => s.type === updatedSw.type);
  if (idx >= 0) {
    sws[idx] = { ...sws[idx], ...updatedSw };
  } else {
    sws.push({
      sub_wallet_id: updatedSw.sub_wallet_id,
      type: updatedSw.type,
      balance_paise: updatedSw.balance_paise,
      status: updatedSw.status || 'ACTIVE',
      monthly_loaded_paise: updatedSw.monthly_loaded_paise || 0,
      loaded_by: updatedSw.loaded_by,
      last_loaded_at: updatedSw.last_loaded_at,
      expiry_date: updatedSw.expiry_date || null,
      transactions: [],
    });
  }
}

export function addSubWalletTransaction(userId, type, txn) {
  const sws = subWalletStore.get(userId);
  if (!sws) return;
  const sw = sws.find(s => s.type === type);
  if (!sw) return;
  if (!sw.transactions) sw.transactions = [];
  sw.transactions.unshift(txn);
}

export function listAllSubWalletData() {
  return subWalletStore;
}

export function listEmployers() {
  return [...employers.values()];
}

// ── Data Access Functions ─────────────────────────────────────────────────────

export function getWalletBalance(userId, { include_runway = false, lookback_days = 30 } = {}) {
  const user = users.get(userId);
  if (!user) return null;

  const result = {
    user_id: user.user_id,
    name: user.name,
    balance: `₹${paisaToRupees(user.balance_paise)}`,
    balance_paise: user.balance_paise.toString(),
    held_amount: `₹${paisaToRupees(user.held_paise)}`,
    currency: 'INR',
    kyc_tier: user.kyc_tier,
    kyc_state: user.kyc_state,
    status: user.state,
    last_updated: formatIST(user.last_activity_at),
  };

  // ABSORB: estimate_balance_runway → include_runway param
  if (include_runway) {
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
    const lowBalance = balancePaise < 100000;
    let recommendation;
    if (daysRemaining === null) recommendation = 'No spending detected — balance is stable.';
    else if (lowBalance) recommendation = 'Balance critically low (under ₹1,000). Top up immediately.';
    else if (daysRemaining < 7) recommendation = 'Balance running low! Consider topping up soon.';
    else if (daysRemaining < 30) recommendation = 'Balance should last a few more weeks at current rate.';
    else recommendation = 'Balance is healthy at your current spending rate.';

    result.runway = {
      analysis_period: `Last ${lookback_days} days`,
      total_spent: `₹${(totalSpentPaise / 100).toFixed(2)}`,
      transactions_count: debitTxns.length,
      avg_daily_spend: `₹${(avgDailySpend / 100).toFixed(2)}`,
      estimated_days_remaining: daysRemaining,
      estimated_exhaustion_date: estimatedDate,
      low_balance_warning: lowBalance,
      recommendation,
    };
  }

  return result;
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
  'Shankari Restaurant': 'Food & Dining',
  'Tea Stall': 'Food & Dining',
  'MSEB': 'Utilities',
  'Blinkit': 'Groceries',
  'D-Mart': 'Groceries',
  'PVR Cinemas': 'Entertainment',
  'Rapido': 'Travel',
  'PharmEasy': 'Health',
  '1mg': 'Health',
  'Udemy': 'Education',
  'BESCOM': 'Utilities',
  'Vi': 'Utilities',
  'Tata Play': 'Entertainment',
  'Hotstar': 'Entertainment',
  'HP Petrol': 'Fuel',
  'IOCL': 'Fuel',
  'Shell': 'Fuel',
  'Bajaj Finserv': 'Bill Payment',
  'HDFC Life': 'Insurance',
  'ICICI Lombard': 'Insurance',
  'Star Health': 'Insurance',
  'Dominos': 'Food & Dining',
  'McDonalds': 'Food & Dining',
  'Croma': 'Shopping',
  'Nykaa': 'Shopping',
  'Decathlon': 'Shopping',
};

function getCategory(txn) {
  if (txn.type === 'load') return 'Wallet Top-up';
  if (txn.type === 'transfer') return 'P2P Transfer';
  return MERCHANT_CATEGORIES[txn.merchant] ?? 'Other';
}

// ── RBI PPI Limits by KYC Tier ───────────────────────────────────────────────
const KYC_LIMITS = {
  MINIMUM: { daily: 1000000, monthly: 1000000, max_balance: 1000000, p2p_monthly: 1000000, label: 'Minimum KYC (₹10,000)' },
  FULL:    { daily: 10000000, monthly: 20000000, max_balance: 20000000, p2p_monthly: 10000000, label: 'Full KYC (₹2,00,000)' },
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
export function getSpendingSummary(userId, days = 30, { group_by = 'category', top_n = 10 } = {}) {
  const user = users.get(userId);
  if (!user) return null;

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  const allTxns = transactions.filter(
    t => t.user_id === userId && new Date(t.timestamp) >= cutoff
  );

  // ── Spending (debits) ──
  const debitTxns = allTxns.filter(t => t.type !== 'load');
  let totalSpentPaise = 0;

  if (group_by === 'merchant') {
    // MERGED: getMerchantInsights logic — group by merchant name
    const merchantPayTxns = debitTxns.filter(t => t.type === 'pay' && t.status === 'success');
    const merchantMap = {};
    for (const t of merchantPayTxns) {
      const name = t.merchant || 'Unknown';
      if (!merchantMap[name]) merchantMap[name] = { total_paise: 0, count: 0, category: getCategory(t), last_visit: t.timestamp };
      merchantMap[name].total_paise += Number(t.amount_paise);
      merchantMap[name].count++;
      if (new Date(t.timestamp) > new Date(merchantMap[name].last_visit)) merchantMap[name].last_visit = t.timestamp;
    }
    const sorted = Object.entries(merchantMap)
      .map(([name, data]) => ({
        merchant: name,
        category: data.category,
        total_spent: `₹${(data.total_paise / 100).toFixed(2)}`,
        total_paise: data.total_paise,
        transaction_count: data.count,
        avg_transaction: `₹${((data.total_paise / data.count) / 100).toFixed(2)}`,
        last_visit: formatIST(data.last_visit),
      }))
      .sort((a, b) => b.total_paise - a.total_paise)
      .slice(0, top_n);
    const totalMerchantSpent = sorted.reduce((s, m) => s + m.total_paise, 0);

    return {
      user_id: userId,
      name: user.name,
      period: `Last ${days} days`,
      group_by: 'merchant',
      total_merchants: Object.keys(merchantMap).length,
      top_merchants: sorted.map(({ total_paise, ...rest }) => ({
        ...rest,
        percentage: totalMerchantSpent > 0 ? `${((total_paise / totalMerchantSpent) * 100).toFixed(1)}%` : '0%',
      })),
      total_merchant_spend: `₹${(totalMerchantSpent / 100).toFixed(2)}`,
      generated_at: formatIST(now().toISOString()),
    };
  }

  // Default: group_by === 'category'
  const categories = {};
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
    group_by: 'category',
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
export function getUserProfile(userId, { include_limits = false } = {}) {
  const user = users.get(userId);
  if (!user) return null;

  const limits = KYC_LIMITS[user.kyc_tier] ?? KYC_LIMITS.MINIMUM;
  const accountAgeDays = Math.floor((now().getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - 30);
  const recentTxns = transactions.filter(t => t.user_id === userId && new Date(t.timestamp) >= cutoff);
  const flaggedCount = transactions.filter(t => t.user_id === userId && t.flagged).length;

  const result = {
    user_id: user.user_id,
    name: user.name,
    phone: user.phone,
    status: user.state,
    kyc: {
      tier: user.kyc_tier,
      state: user.kyc_state,
      label: limits.label,
      aadhaar_verified: user.aadhaar_verified,
      pan_masked: user.pan_masked,
      ckyc_number: user.ckyc_number,
      wallet_expiry_date: user.wallet_expiry_date ? formatIST(user.wallet_expiry_date) : null,
      rejected_reason: user.rejected_reason,
    },
    balance: `₹${paisaToRupees(user.balance_paise)}`,
    balance_paise: user.balance_paise.toString(),
    held_amount: `₹${paisaToRupees(user.held_paise)}`,
    available_balance: `₹${paisaToRupees(user.balance_paise - user.held_paise)}`,
    limits: {
      daily_limit: `₹${(limits.daily / 100).toFixed(2)}`,
      monthly_limit: `₹${(limits.monthly / 100).toFixed(2)}`,
      max_balance: `₹${(limits.max_balance / 100).toFixed(2)}`,
    },
    limits_usage: {
      monthly_p2p_mtd: `₹${paisaToRupees(user.monthly_p2p_mtd_paise)}`,
      annual_load_ytd: `₹${paisaToRupees(user.annual_load_ytd_paise)}`,
    },
    account_age_days: accountAgeDays,
    created_at: formatIST(user.created_at),
    last_activity: formatIST(user.last_activity_at),
    recent_activity: {
      transactions_last_30_days: recentTxns.length,
      flagged_transactions: flaggedCount,
    },
  };

  // ABSORB: checkLimits → include_limits param (real-time utilization detail)
  if (include_limits) {
    const todayStart = new Date(now()); todayStart.setHours(0, 0, 0, 0);
    const todayTxns = transactions.filter(t => t.user_id === userId && t.type !== 'load' && new Date(t.timestamp) >= todayStart);
    const dailySpentPaise = todayTxns.reduce((s, t) => s + Number(t.amount_paise), 0);
    const monthStart = new Date(now()); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const monthTxns = transactions.filter(t => t.user_id === userId && t.type !== 'load' && new Date(t.timestamp) >= monthStart);
    const monthlySpentPaise = monthTxns.reduce((s, t) => s + Number(t.amount_paise), 0);

    result.limits_detail = {
      daily: { limit: `₹${(limits.daily / 100).toFixed(2)}`, used: `₹${(dailySpentPaise / 100).toFixed(2)}`, remaining: `₹${(Math.max(0, limits.daily - dailySpentPaise) / 100).toFixed(2)}`, utilization: `${((dailySpentPaise / limits.daily) * 100).toFixed(1)}%` },
      monthly: { limit: `₹${(limits.monthly / 100).toFixed(2)}`, used: `₹${(monthlySpentPaise / 100).toFixed(2)}`, remaining: `₹${(Math.max(0, limits.monthly - monthlySpentPaise) / 100).toFixed(2)}`, utilization: `${((monthlySpentPaise / limits.monthly) * 100).toFixed(1)}%` },
      max_balance: { limit: `₹${(limits.max_balance / 100).toFixed(2)}`, current: `₹${paisaToRupees(user.balance_paise)}`, utilization: `${((Number(user.balance_paise) / limits.max_balance) * 100).toFixed(1)}%` },
      p2p_monthly: { limit: `₹${(limits.p2p_monthly / 100).toFixed(2)}`, used: `₹${paisaToRupees(user.monthly_p2p_mtd_paise)}`, remaining: `₹${((limits.p2p_monthly - Number(user.monthly_p2p_mtd_paise)) / 100).toFixed(2)}`, utilization: `${((Number(user.monthly_p2p_mtd_paise) / limits.p2p_monthly) * 100).toFixed(1)}%` },
    };
    result.limits_warnings = [
      ...(dailySpentPaise >= limits.daily * 0.8 ? [`Daily limit ${((dailySpentPaise / limits.daily) * 100).toFixed(0)}% utilized`] : []),
      ...(monthlySpentPaise >= limits.monthly * 0.8 ? [`Monthly limit ${((monthlySpentPaise / limits.monthly) * 100).toFixed(0)}% utilized`] : []),
      ...(Number(user.balance_paise) >= limits.max_balance * 0.8 ? [`Balance at ${((Number(user.balance_paise) / limits.max_balance) * 100).toFixed(0)}% of max`] : []),
    ];
    result.limits_generated_at = formatIST(now().toISOString());
  }

  return result;
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
    kyc_tier: u.kyc_tier,
    kyc_state: u.kyc_state,
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

export function searchUsers({ query, kyc_tier, kyc_state, status, min_balance, max_balance, limit, offset = 0 } = {}) {
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
  if (kyc_state) results = results.filter(u => u.kyc_state === kyc_state.toUpperCase());
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
      kyc_state: u.kyc_state,
      aadhaar_verified: u.aadhaar_verified,
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

/**
 * Get KYC statistics across all users.
 * Returns distribution by state, pending queue, success/failure rates.
 */
export function getKycStats() {
  const allUsers = Array.from(users.values());
  const total = allUsers.length;

  // Distribution by kyc_state
  const stateCounts = {};
  for (const u of allUsers) {
    stateCounts[u.kyc_state] = (stateCounts[u.kyc_state] || 0) + 1;
  }
  const distribution = Object.entries(stateCounts).map(([state, count]) => ({
    state,
    count,
    percentage: Number(((count / total) * 100).toFixed(1)),
  }));

  // Tier breakdown
  const fullKycUsers = allUsers.filter(u => u.kyc_state === 'FULL_KYC').length;
  const minKycUsers = allUsers.filter(u => u.kyc_state === 'MIN_KYC').length;
  const pendingUsers = allUsers.filter(u => u.kyc_state === 'FULL_KYC_PENDING');
  const rejectedUsers = allUsers.filter(u => u.kyc_state === 'REJECTED');
  const suspendedKyc = allUsers.filter(u => u.kyc_state === 'SUSPENDED');

  // Pending KYC queue
  const pendingQueue = pendingUsers.map(u => ({
    user_id: u.user_id,
    name: u.name,
    phone: u.phone,
    current_state: u.kyc_state,
    aadhaar_verified: u.aadhaar_verified,
    pan_masked: u.pan_masked,
    requested_tier: 'FULL',
    submitted_at: formatIST(u.last_activity_at),
  }));

  // Expiring wallets (MINIMUM KYC with expiry within 30 days)
  const expiringCutoff = new Date(now());
  expiringCutoff.setDate(expiringCutoff.getDate() + 30);
  const expiringWallets = allUsers
    .filter(u => u.wallet_expiry_date && new Date(u.wallet_expiry_date) <= expiringCutoff)
    .map(u => ({
      user_id: u.user_id,
      name: u.name,
      kyc_tier: u.kyc_tier,
      expiry_date: formatIST(u.wallet_expiry_date),
      days_until_expiry: Math.ceil((new Date(u.wallet_expiry_date).getTime() - now().getTime()) / (1000 * 60 * 60 * 24)),
    }));

  return {
    total_users: total,
    distribution,
    tier_breakdown: {
      FULL: allUsers.filter(u => u.kyc_tier === 'FULL').length,
      MINIMUM: allUsers.filter(u => u.kyc_tier === 'MINIMUM').length,
    },
    success_rate: Number(((fullKycUsers / total) * 100).toFixed(1)),
    failure_rate: Number(((rejectedUsers.length / total) * 100).toFixed(1)),
    pending_count: pendingUsers.length,
    pending_queue: pendingQueue,
    rejected_count: rejectedUsers.length,
    rejected_users: rejectedUsers.map(u => ({
      user_id: u.user_id,
      name: u.name,
      reason: u.rejected_reason,
    })),
    suspended_count: suspendedKyc.length,
    expiring_wallets: expiringWallets,
    avg_verification_minutes: 12,  // simulated
    generated_at: formatIST(now().toISOString()),
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// NEW WALLET FEATURES
// ═════════════════════════════════════════════════════════════════════════════

// ── Transaction Operations ───────────────────────────────────────────────────

export function addMoney(userId, { amount_paise, source = 'UPI' } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };
  if (user.state === 'SUSPENDED') return { error: 'Account suspended — cannot add money', user_id: userId };

  const amtBig = BigInt(amount_paise);
  if (amtBig <= 0n) return { error: 'Amount must be positive' };

  const limits = KYC_LIMITS[user.kyc_tier] ?? KYC_LIMITS.MINIMUM;
  const newBalance = user.balance_paise + amtBig;
  if (Number(newBalance) > limits.max_balance) {
    return { error: `Would exceed ${user.kyc_tier} KYC max balance of ₹${(limits.max_balance / 100).toFixed(2)}`, current_balance: `₹${paisaToRupees(user.balance_paise)}`, max_allowed: `₹${(limits.max_balance / 100).toFixed(2)}` };
  }

  const txnId = `txn_${String(transactions.length + 100).padStart(3, '0')}`;
  const txn = { txn_id: txnId, user_id: userId, type: 'load', amount_paise: amtBig, merchant: null, description: `Wallet Top-up via ${source}`, timestamp: now().toISOString(), status: 'success', flagged: false, flag_reason: null, flagged_at: null };
  transactions.push(txn);

  user.balance_paise = newBalance;
  user.annual_load_ytd_paise += amtBig;
  user.last_activity_at = now().toISOString();

  return {
    success: true,
    txn_id: txnId,
    user_id: userId,
    name: user.name,
    amount_added: `₹${paisaToRupees(amtBig)}`,
    source,
    new_balance: `₹${paisaToRupees(user.balance_paise)}`,
    timestamp: formatIST(now().toISOString()),
  };
}

export function payMerchant(userId, { amount_paise, merchant_name, description } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };
  if (user.state === 'SUSPENDED') return { error: 'Account suspended — cannot make payments', user_id: userId };

  const amtBig = BigInt(amount_paise);
  if (amtBig <= 0n) return { error: 'Amount must be positive' };
  if (user.balance_paise < amtBig) {
    return { error: 'Insufficient balance', current_balance: `₹${paisaToRupees(user.balance_paise)}`, required: `₹${paisaToRupees(amtBig)}` };
  }

  const txnId = `txn_${String(transactions.length + 100).padStart(3, '0')}`;
  const txn = { txn_id: txnId, user_id: userId, type: 'pay', amount_paise: amtBig, merchant: merchant_name, description: description || `Payment to ${merchant_name}`, timestamp: now().toISOString(), status: 'success', flagged: false, flag_reason: null, flagged_at: null };
  transactions.push(txn);

  user.balance_paise -= amtBig;
  user.last_activity_at = now().toISOString();

  return {
    success: true,
    txn_id: txnId,
    user_id: userId,
    name: user.name,
    amount_paid: `₹${paisaToRupees(amtBig)}`,
    merchant: merchant_name,
    description: txn.description,
    new_balance: `₹${paisaToRupees(user.balance_paise)}`,
    timestamp: formatIST(now().toISOString()),
  };
}

export function transferP2P(userId, { amount_paise, recipient_id, note } = {}) {
  const sender = users.get(userId);
  if (!sender) return { error: 'Sender not found', user_id: userId };
  if (sender.state === 'SUSPENDED') return { error: 'Sender account suspended', user_id: userId };

  const recipient = users.get(recipient_id);
  if (!recipient) return { error: 'Recipient not found', recipient_id };
  if (recipient.state === 'SUSPENDED') return { error: 'Recipient account suspended', recipient_id };
  if (userId === recipient_id) return { error: 'Cannot transfer to yourself' };

  const amtBig = BigInt(amount_paise);
  if (amtBig <= 0n) return { error: 'Amount must be positive' };
  if (sender.balance_paise < amtBig) {
    return { error: 'Insufficient balance', current_balance: `₹${paisaToRupees(sender.balance_paise)}`, required: `₹${paisaToRupees(amtBig)}` };
  }

  const limits = KYC_LIMITS[sender.kyc_tier] ?? KYC_LIMITS.MINIMUM;
  if (Number(sender.monthly_p2p_mtd_paise + amtBig) > limits.p2p_monthly) {
    return { error: `Would exceed monthly P2P limit of ₹${(limits.p2p_monthly / 100).toFixed(2)}`, current_p2p_mtd: `₹${paisaToRupees(sender.monthly_p2p_mtd_paise)}`, limit: `₹${(limits.p2p_monthly / 100).toFixed(2)}` };
  }

  const debitTxnId = `txn_${String(transactions.length + 100).padStart(3, '0')}`;
  const creditTxnId = `txn_${String(transactions.length + 101).padStart(3, '0')}`;

  transactions.push({ txn_id: debitTxnId, user_id: userId, type: 'transfer', amount_paise: amtBig, merchant: null, description: note || `P2P transfer to ${recipient.name}`, timestamp: now().toISOString(), status: 'success', flagged: false, flag_reason: null, flagged_at: null });
  transactions.push({ txn_id: creditTxnId, user_id: recipient_id, type: 'load', amount_paise: amtBig, merchant: null, description: `P2P from ${sender.name}`, timestamp: now().toISOString(), status: 'success', flagged: false, flag_reason: null, flagged_at: null });

  sender.balance_paise -= amtBig;
  recipient.balance_paise += amtBig;
  sender.monthly_p2p_mtd_paise += amtBig;
  sender.last_activity_at = now().toISOString();
  recipient.last_activity_at = now().toISOString();

  return {
    success: true,
    debit_txn_id: debitTxnId,
    credit_txn_id: creditTxnId,
    sender: { user_id: userId, name: sender.name, new_balance: `₹${paisaToRupees(sender.balance_paise)}` },
    recipient: { user_id: recipient_id, name: recipient.name, new_balance: `₹${paisaToRupees(recipient.balance_paise)}` },
    amount: `₹${paisaToRupees(amtBig)}`,
    note: note || null,
    timestamp: formatIST(now().toISOString()),
  };
}

export function payBill(userId, { amount_paise, biller_name, bill_number, category = 'Utilities' } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };
  if (user.state === 'SUSPENDED') return { error: 'Account suspended — cannot pay bills', user_id: userId };

  const amtBig = BigInt(amount_paise);
  if (amtBig <= 0n) return { error: 'Amount must be positive' };
  if (user.balance_paise < amtBig) {
    return { error: 'Insufficient balance', current_balance: `₹${paisaToRupees(user.balance_paise)}`, required: `₹${paisaToRupees(amtBig)}` };
  }

  const txnId = `txn_${String(transactions.length + 100).padStart(3, '0')}`;
  const desc = bill_number ? `${biller_name} - Bill #${bill_number}` : `${biller_name} Bill Payment`;
  const txn = { txn_id: txnId, user_id: userId, type: 'pay', amount_paise: amtBig, merchant: biller_name, description: desc, timestamp: now().toISOString(), status: 'success', flagged: false, flag_reason: null, flagged_at: null };
  transactions.push(txn);

  user.balance_paise -= amtBig;
  user.last_activity_at = now().toISOString();

  return {
    success: true,
    txn_id: txnId,
    user_id: userId,
    name: user.name,
    amount_paid: `₹${paisaToRupees(amtBig)}`,
    biller: biller_name,
    bill_number: bill_number || null,
    category,
    new_balance: `₹${paisaToRupees(user.balance_paise)}`,
    timestamp: formatIST(now().toISOString()),
  };
}

export function requestRefund(userId, { txn_id, reason } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  const txn = transactions.find(t => t.txn_id === txn_id && t.user_id === userId);
  if (!txn) return { error: 'Transaction not found for this user', txn_id };
  if (txn.type === 'load') return { error: 'Cannot refund a wallet top-up', txn_id };

  const existing = refunds.find(r => r.txn_id === txn_id && r.status !== 'rejected');
  if (existing) return { error: 'Refund already requested for this transaction', existing_refund_id: existing.refund_id, status: existing.status };

  const refundId = `RFD-${String(nextRefundId++).padStart(3, '0')}`;
  const refund = { refund_id: refundId, user_id: userId, txn_id, amount_paise: txn.amount_paise, reason, status: 'pending', created_at: now().toISOString(), completed_at: null };
  refunds.push(refund);

  return {
    success: true,
    refund_id: refundId,
    user_id: userId,
    name: user.name,
    txn_id,
    original_amount: `₹${paisaToRupees(txn.amount_paise)}`,
    reason,
    status: 'pending',
    estimated_completion: '3-5 business days',
    created_at: formatIST(now().toISOString()),
  };
}

// ── Limits & Compliance ──────────────────────────────────────────────────────

export function checkLimits(userId) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  const limits = KYC_LIMITS[user.kyc_tier] ?? KYC_LIMITS.MINIMUM;

  // Calculate today's spend
  const todayStart = new Date(now());
  todayStart.setHours(0, 0, 0, 0);
  const todayTxns = transactions.filter(t => t.user_id === userId && t.type !== 'load' && new Date(t.timestamp) >= todayStart);
  const dailySpentPaise = todayTxns.reduce((s, t) => s + Number(t.amount_paise), 0);

  // Calculate this month's spend
  const monthStart = new Date(now());
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthTxns = transactions.filter(t => t.user_id === userId && t.type !== 'load' && new Date(t.timestamp) >= monthStart);
  const monthlySpentPaise = monthTxns.reduce((s, t) => s + Number(t.amount_paise), 0);

  return {
    user_id: userId,
    name: user.name,
    kyc_tier: user.kyc_tier,
    limits: {
      daily: { limit: `₹${(limits.daily / 100).toFixed(2)}`, used: `₹${(dailySpentPaise / 100).toFixed(2)}`, remaining: `₹${(Math.max(0, limits.daily - dailySpentPaise) / 100).toFixed(2)}`, utilization: `${((dailySpentPaise / limits.daily) * 100).toFixed(1)}%` },
      monthly: { limit: `₹${(limits.monthly / 100).toFixed(2)}`, used: `₹${(monthlySpentPaise / 100).toFixed(2)}`, remaining: `₹${(Math.max(0, limits.monthly - monthlySpentPaise) / 100).toFixed(2)}`, utilization: `${((monthlySpentPaise / limits.monthly) * 100).toFixed(1)}%` },
      max_balance: { limit: `₹${(limits.max_balance / 100).toFixed(2)}`, current: `₹${paisaToRupees(user.balance_paise)}`, utilization: `${((Number(user.balance_paise) / limits.max_balance) * 100).toFixed(1)}%` },
      p2p_monthly: { limit: `₹${(limits.p2p_monthly / 100).toFixed(2)}`, used: `₹${paisaToRupees(user.monthly_p2p_mtd_paise)}`, remaining: `₹${((limits.p2p_monthly - Number(user.monthly_p2p_mtd_paise)) / 100).toFixed(2)}`, utilization: `${((Number(user.monthly_p2p_mtd_paise) / limits.p2p_monthly) * 100).toFixed(1)}%` },
    },
    warnings: [
      ...(dailySpentPaise >= limits.daily * 0.8 ? [`Daily limit ${((dailySpentPaise / limits.daily) * 100).toFixed(0)}% utilized`] : []),
      ...(monthlySpentPaise >= limits.monthly * 0.8 ? [`Monthly limit ${((monthlySpentPaise / limits.monthly) * 100).toFixed(0)}% utilized`] : []),
      ...(Number(user.balance_paise) >= limits.max_balance * 0.8 ? [`Balance at ${((Number(user.balance_paise) / limits.max_balance) * 100).toFixed(0)}% of max`] : []),
    ],
    generated_at: formatIST(now().toISOString()),
  };
}

export function checkCompliance(userId, { include_risk_score = false } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  const limits = KYC_LIMITS[user.kyc_tier] ?? KYC_LIMITS.MINIMUM;
  const issues = [];
  const warnings = [];

  // Balance check
  if (Number(user.balance_paise) > limits.max_balance) {
    issues.push({ type: 'BALANCE_EXCEEDS_LIMIT', severity: 'critical', detail: `Balance ₹${paisaToRupees(user.balance_paise)} exceeds ${user.kyc_tier} limit of ₹${(limits.max_balance / 100).toFixed(2)}` });
  }

  // KYC state checks
  if (user.kyc_state === 'REJECTED') {
    issues.push({ type: 'KYC_REJECTED', severity: 'critical', detail: `KYC rejected: ${user.rejected_reason}` });
  }
  if (user.kyc_state === 'SUSPENDED') {
    issues.push({ type: 'KYC_SUSPENDED', severity: 'critical', detail: 'KYC suspended due to non-compliance' });
  }
  if (user.kyc_state === 'MIN_KYC' && user.wallet_expiry_date) {
    const daysToExpiry = Math.ceil((new Date(user.wallet_expiry_date).getTime() - now().getTime()) / 86400000);
    if (daysToExpiry < 30) {
      warnings.push({ type: 'WALLET_EXPIRING_SOON', detail: `Minimum KYC wallet expires in ${daysToExpiry} days. Upgrade to Full KYC required.` });
    }
  }

  // P2P limit check
  if (Number(user.monthly_p2p_mtd_paise) > limits.p2p_monthly * 0.9) {
    warnings.push({ type: 'P2P_LIMIT_NEAR', detail: `P2P usage at ${((Number(user.monthly_p2p_mtd_paise) / limits.p2p_monthly) * 100).toFixed(0)}% of monthly limit` });
  }

  // Flagged transactions
  const flaggedTxns = transactions.filter(t => t.user_id === userId && t.flagged);
  if (flaggedTxns.length > 0) {
    warnings.push({ type: 'FLAGGED_TRANSACTIONS', detail: `${flaggedTxns.length} transaction(s) flagged for review` });
  }

  // Aadhaar check for FULL KYC
  if (user.kyc_tier === 'FULL' && !user.aadhaar_verified) {
    issues.push({ type: 'AADHAAR_NOT_VERIFIED', severity: 'high', detail: 'Full KYC account without Aadhaar verification' });
  }

  const isCompliant = issues.length === 0;

  const result = {
    user_id: userId,
    name: user.name,
    kyc_tier: user.kyc_tier,
    kyc_state: user.kyc_state,
    is_compliant: isCompliant,
    compliance_status: isCompliant ? (warnings.length > 0 ? 'COMPLIANT_WITH_WARNINGS' : 'FULLY_COMPLIANT') : 'NON_COMPLIANT',
    issues,
    warnings,
    recommendation: !isCompliant ? 'Immediate action required to resolve compliance issues.' : warnings.length > 0 ? 'Address warnings to maintain compliance.' : 'Account fully compliant with RBI PPI regulations.',
    checked_at: formatIST(now().toISOString()),
  };

  // MERGED: getUserRiskProfile → include_risk_score param
  if (include_risk_score) {
    const userTxns = transactions.filter(t => t.user_id === userId);
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

    result.phone = user.phone;
    result.wallet_state = user.state || user.wallet_state || 'ACTIVE';
    result.risk_assessment = {
      risk_score: riskScore,
      risk_level: riskLevel,
      risk_factors: riskFactors.length > 0 ? riskFactors : ['No significant risk signals detected'],
    };
    result.risk_recommendation = riskScore >= 60
      ? 'Immediate review recommended. Consider temporary suspension pending investigation.'
      : riskScore >= 30
        ? 'Monitor closely. Review flagged transactions and unusual activity patterns.'
        : 'No immediate action required. Standard monitoring sufficient.';
    result.activity_summary = {
      total_transactions: userTxns.length,
      flagged_transactions: flaggedCount,
      failed_transactions: failedCount,
      pending_transactions: pendingCount,
      high_value_transactions: highValueTxns.length,
      transactions_last_24h: txns24h.length,
    };
    result.financial_summary = {
      current_balance: `₹${paisaToRupees(user.balance_paise)}`,
      kyc_limit: `₹${paisaToRupees(limits.max_balance)}`,
      balance_utilization: `${(balanceRatio * 100).toFixed(1)}%`,
      p2p_transfer_volume: `₹${paisaToRupees(p2pVolumePaise)}`,
      p2p_transfer_count: p2pTxns.length,
    };
    result.flagged_details = userTxns.filter(t => t.flagged).map(t => ({
      txn_id: t.txn_id, amount: `₹${paisaToRupees(t.amount_paise)}`, reason: t.flag_reason, flagged_at: t.flagged_at ? formatIST(t.flagged_at) : null,
    }));
  }

  return result;
}

// ── Disputes & Support ───────────────────────────────────────────────────────

export function raiseDispute(userId, { txn_id, type = 'failed_transaction', description } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  const txn = transactions.find(t => t.txn_id === txn_id && t.user_id === userId);
  if (!txn) return { error: 'Transaction not found for this user', txn_id };

  const existing = disputes.find(d => d.txn_id === txn_id && d.user_id === userId && d.status !== 'resolved' && d.status !== 'rejected');
  if (existing) return { error: 'Active dispute already exists for this transaction', existing_dispute_id: existing.dispute_id, status: existing.status };

  const disputeId = `DSP-${String(nextDisputeId++).padStart(3, '0')}`;
  const dispute = { dispute_id: disputeId, user_id: userId, txn_id, type, description, status: 'open', created_at: now().toISOString(), resolved_at: null, resolution: null };
  disputes.push(dispute);

  return {
    success: true,
    dispute_id: disputeId,
    user_id: userId,
    name: user.name,
    txn_id,
    original_amount: `₹${paisaToRupees(txn.amount_paise)}`,
    type,
    description,
    status: 'open',
    estimated_resolution: '5-7 business days',
    created_at: formatIST(now().toISOString()),
  };
}

export function getDisputeStatus(userId, { dispute_id } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  if (dispute_id) {
    const d = disputes.find(d => d.dispute_id === dispute_id && d.user_id === userId);
    if (!d) return { error: 'Dispute not found', dispute_id };

    const txn = transactions.find(t => t.txn_id === d.txn_id);
    return {
      dispute_id: d.dispute_id,
      user_id: userId,
      name: user.name,
      txn_id: d.txn_id,
      transaction_amount: txn ? `₹${paisaToRupees(txn.amount_paise)}` : 'N/A',
      type: d.type,
      description: d.description,
      status: d.status,
      created_at: formatIST(d.created_at),
      resolved_at: d.resolved_at ? formatIST(d.resolved_at) : null,
      resolution: d.resolution,
    };
  }

  // List all disputes for user
  const userDisputes = disputes.filter(d => d.user_id === userId).map(d => {
    const txn = transactions.find(t => t.txn_id === d.txn_id);
    return {
      dispute_id: d.dispute_id,
      txn_id: d.txn_id,
      transaction_amount: txn ? `₹${paisaToRupees(txn.amount_paise)}` : 'N/A',
      type: d.type,
      status: d.status,
      created_at: formatIST(d.created_at),
      resolution: d.resolution,
    };
  });

  return {
    user_id: userId,
    name: user.name,
    total_disputes: userDisputes.length,
    open: userDisputes.filter(d => d.status === 'open' || d.status === 'under_review').length,
    resolved: userDisputes.filter(d => d.status === 'resolved').length,
    disputes: userDisputes,
  };
}

export function getRefundStatus(userId, { refund_id } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  if (refund_id) {
    const r = refunds.find(r => r.refund_id === refund_id && r.user_id === userId);
    if (!r) return { error: 'Refund not found', refund_id };

    return {
      refund_id: r.refund_id,
      user_id: userId,
      name: user.name,
      txn_id: r.txn_id,
      amount: `₹${paisaToRupees(r.amount_paise)}`,
      reason: r.reason,
      status: r.status,
      created_at: formatIST(r.created_at),
      completed_at: r.completed_at ? formatIST(r.completed_at) : null,
    };
  }

  // List all refunds for user
  const userRefunds = refunds.filter(r => r.user_id === userId).map(r => ({
    refund_id: r.refund_id,
    txn_id: r.txn_id,
    amount: `₹${paisaToRupees(r.amount_paise)}`,
    reason: r.reason,
    status: r.status,
    created_at: formatIST(r.created_at),
    completed_at: r.completed_at ? formatIST(r.completed_at) : null,
  }));

  return {
    user_id: userId,
    name: user.name,
    total_refunds: userRefunds.length,
    pending: userRefunds.filter(r => r.status === 'pending').length,
    completed: userRefunds.filter(r => r.status === 'completed').length,
    refunds: userRefunds,
  };
}

// ── Notifications ────────────────────────────────────────────────────────────

export function getNotifications(userId, { unread_only = false, limit = 20 } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  let userNotifs = notifications
    .filter(n => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const totalCount = userNotifs.length;
  const unreadCount = userNotifs.filter(n => !n.read).length;

  if (unread_only) {
    userNotifs = userNotifs.filter(n => !n.read);
  }

  userNotifs = userNotifs.slice(0, limit);

  return {
    user_id: userId,
    name: user.name,
    total_notifications: totalCount,
    unread_count: unreadCount,
    showing: userNotifs.length,
    notifications: userNotifs.map(n => ({
      notif_id: n.notif_id,
      type: n.type,
      title: n.title,
      message: n.message,
      read: n.read,
      created_at: formatIST(n.created_at),
    })),
  };
}

export function setAlertThreshold(userId, { low_balance, high_transaction, daily_spend } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  const current = alertThresholds.get(userId) || { low_balance: 50000, high_transaction: 500000, daily_spend: 1000000 };

  if (low_balance !== undefined) current.low_balance = Math.round(low_balance * 100);
  if (high_transaction !== undefined) current.high_transaction = Math.round(high_transaction * 100);
  if (daily_spend !== undefined) current.daily_spend = Math.round(daily_spend * 100);

  alertThresholds.set(userId, current);

  return {
    success: true,
    user_id: userId,
    name: user.name,
    thresholds: {
      low_balance: `₹${(current.low_balance / 100).toFixed(2)}`,
      high_transaction: `₹${(current.high_transaction / 100).toFixed(2)}`,
      daily_spend: `₹${(current.daily_spend / 100).toFixed(2)}`,
    },
    updated_at: formatIST(now().toISOString()),
  };
}

// ── KYC Actions (Admin) ──────────────────────────────────────────────────────

export function approveKyc(userId, { admin_notes } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  if (user.kyc_state !== 'FULL_KYC_PENDING') {
    return { error: `Cannot approve — current KYC state is ${user.kyc_state}. Only FULL_KYC_PENDING can be approved.`, user_id: userId, current_state: user.kyc_state };
  }

  const previousState = user.kyc_state;
  user.kyc_state = 'FULL_KYC';
  user.kyc_tier = 'FULL';
  user.wallet_expiry_date = null;
  user.ckyc_number = `CKYC-${Date.now().toString().slice(-8)}`;

  return {
    success: true,
    user_id: userId,
    name: user.name,
    previous_kyc_state: previousState,
    new_kyc_state: user.kyc_state,
    new_kyc_tier: user.kyc_tier,
    ckyc_number: user.ckyc_number,
    admin_notes: admin_notes || null,
    approved_by: 'admin-claude',
    approved_at: formatIST(now().toISOString()),
  };
}

export function rejectKyc(userId, { reason } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  if (user.kyc_state !== 'FULL_KYC_PENDING') {
    return { error: `Cannot reject — current KYC state is ${user.kyc_state}. Only FULL_KYC_PENDING can be rejected.`, user_id: userId, current_state: user.kyc_state };
  }

  const previousState = user.kyc_state;
  user.kyc_state = 'REJECTED';
  user.rejected_reason = reason;

  return {
    success: true,
    user_id: userId,
    name: user.name,
    previous_kyc_state: previousState,
    new_kyc_state: user.kyc_state,
    reason,
    rejected_by: 'admin-claude',
    rejected_at: formatIST(now().toISOString()),
  };
}

export function requestKycUpgrade(userId) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  if (user.kyc_state === 'FULL_KYC') {
    return { error: 'Already at Full KYC', user_id: userId, current_state: user.kyc_state };
  }
  if (user.kyc_state === 'FULL_KYC_PENDING') {
    return { error: 'KYC upgrade already pending', user_id: userId, current_state: user.kyc_state };
  }
  if (user.kyc_state === 'SUSPENDED') {
    return { error: 'Cannot upgrade — KYC is suspended', user_id: userId };
  }

  const previousState = user.kyc_state;
  user.kyc_state = 'FULL_KYC_PENDING';
  user.aadhaar_verified = true;
  user.last_activity_at = now().toISOString();

  // Add notification
  const notifId = `NTF-${String(nextNotifId++).padStart(3, '0')}`;
  notifications.push({ notif_id: notifId, user_id: userId, type: 'kyc', title: 'KYC Upgrade Requested', message: 'Your Full KYC verification request has been submitted. You will be notified once reviewed.', read: false, created_at: now().toISOString() });

  return {
    success: true,
    user_id: userId,
    name: user.name,
    previous_kyc_state: previousState,
    new_kyc_state: user.kyc_state,
    documents_required: ['Aadhaar (verified)', 'PAN Card', 'Video KYC'],
    estimated_processing: '24-48 hours',
    submitted_at: formatIST(now().toISOString()),
  };
}

// ── Analytics ────────────────────────────────────────────────────────────────

export function getMerchantInsights(userId, { days = 30, top_n = 10 } = {}) {
  const user = users.get(userId);
  if (!user) return { error: 'User not found', user_id: userId };

  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  const userTxns = transactions
    .filter(t => t.user_id === userId && t.type === 'pay' && new Date(t.timestamp) >= cutoff && t.status === 'success');

  const merchantMap = {};
  for (const t of userTxns) {
    const name = t.merchant || 'Unknown';
    if (!merchantMap[name]) merchantMap[name] = { total_paise: 0, count: 0, category: getCategory(t), last_visit: t.timestamp };
    merchantMap[name].total_paise += Number(t.amount_paise);
    merchantMap[name].count++;
    if (new Date(t.timestamp) > new Date(merchantMap[name].last_visit)) merchantMap[name].last_visit = t.timestamp;
  }

  const sorted = Object.entries(merchantMap)
    .map(([name, data]) => ({
      merchant: name,
      category: data.category,
      total_spent: `₹${(data.total_paise / 100).toFixed(2)}`,
      total_paise: data.total_paise,
      transaction_count: data.count,
      avg_transaction: `₹${((data.total_paise / data.count) / 100).toFixed(2)}`,
      last_visit: formatIST(data.last_visit),
    }))
    .sort((a, b) => b.total_paise - a.total_paise)
    .slice(0, top_n);

  const totalSpent = sorted.reduce((s, m) => s + m.total_paise, 0);

  return {
    user_id: userId,
    name: user.name,
    period: `Last ${days} days`,
    total_merchants: Object.keys(merchantMap).length,
    top_merchants: sorted.map(({ total_paise, ...rest }) => ({
      ...rest,
      percentage: totalSpent > 0 ? `${((total_paise / totalSpent) * 100).toFixed(1)}%` : '0%',
    })),
    total_merchant_spend: `₹${(totalSpent / 100).toFixed(2)}`,
  };
}

export function getPeakUsage({ days = 30 } = {}) {
  const cutoff = new Date(now());
  cutoff.setDate(cutoff.getDate() - days);

  const recentTxns = transactions.filter(t => new Date(t.timestamp) >= cutoff);

  // By hour
  const hourly = new Array(24).fill(0);
  const hourlyCount = new Array(24).fill(0);
  for (const t of recentTxns) {
    const h = new Date(t.timestamp).getHours();
    hourly[h] += Number(t.amount_paise);
    hourlyCount[h]++;
  }

  const peakHour = hourlyCount.indexOf(Math.max(...hourlyCount));
  const quietHour = hourlyCount.indexOf(Math.min(...hourlyCount.filter(c => c >= 0)));

  // By day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daily = new Array(7).fill(0);
  const dailyCount = new Array(7).fill(0);
  for (const t of recentTxns) {
    const d = new Date(t.timestamp).getDay();
    daily[d] += Number(t.amount_paise);
    dailyCount[d]++;
  }

  const peakDay = dailyCount.indexOf(Math.max(...dailyCount));

  // By transaction type
  const typeBreakdown = {};
  for (const t of recentTxns) {
    if (!typeBreakdown[t.type]) typeBreakdown[t.type] = { count: 0, volume_paise: 0 };
    typeBreakdown[t.type].count++;
    typeBreakdown[t.type].volume_paise += Number(t.amount_paise);
  }

  return {
    period: `Last ${days} days`,
    total_transactions: recentTxns.length,
    peak_hour: { hour: `${peakHour}:00 - ${peakHour + 1}:00`, transactions: hourlyCount[peakHour], volume: `₹${(hourly[peakHour] / 100).toFixed(2)}` },
    quiet_hour: { hour: `${quietHour}:00 - ${quietHour + 1}:00`, transactions: hourlyCount[quietHour] },
    peak_day: { day: dayNames[peakDay], transactions: dailyCount[peakDay], volume: `₹${(daily[peakDay] / 100).toFixed(2)}` },
    hourly_distribution: hourlyCount.map((count, i) => ({ hour: `${i}:00`, transactions: count, volume: `₹${(hourly[i] / 100).toFixed(2)}` })).filter(h => h.transactions > 0),
    type_breakdown: Object.entries(typeBreakdown).map(([type, data]) => ({ type, count: data.count, volume: `₹${(data.volume_paise / 100).toFixed(2)}` })),
    generated_at: formatIST(now().toISOString()),
  };
}

export function getMonthlyTrends({ months = 3 } = {}) {
  const allUsers = Array.from(users.values());
  const monthlyData = [];

  for (let i = 0; i < months; i++) {
    const monthEnd = new Date(now());
    monthEnd.setMonth(monthEnd.getMonth() - i);
    monthEnd.setDate(1);
    if (i === 0) {
      // Current month — use now() as end
    } else {
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0); // last day of month
    }

    const monthStart = new Date(now());
    monthStart.setMonth(monthStart.getMonth() - i);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const endDate = i === 0 ? now() : monthEnd;

    const monthTxns = transactions.filter(t => new Date(t.timestamp) >= monthStart && new Date(t.timestamp) < endDate);

    const debitTxns = monthTxns.filter(t => t.type !== 'load');
    const creditTxns = monthTxns.filter(t => t.type === 'load');
    const debitPaise = debitTxns.reduce((s, t) => s + Number(t.amount_paise), 0);
    const creditPaise = creditTxns.reduce((s, t) => s + Number(t.amount_paise), 0);

    const activeUsers = new Set(monthTxns.map(t => t.user_id)).size;
    const failedCount = monthTxns.filter(t => t.status === 'failed').length;

    const monthName = monthStart.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    monthlyData.push({
      month: monthName,
      total_transactions: monthTxns.length,
      total_debit: `₹${(debitPaise / 100).toFixed(2)}`,
      total_credit: `₹${(creditPaise / 100).toFixed(2)}`,
      net_flow: `${creditPaise >= debitPaise ? '+' : '-'}₹${(Math.abs(creditPaise - debitPaise) / 100).toFixed(2)}`,
      active_users: activeUsers,
      failed_transactions: failedCount,
      avg_transaction_value: monthTxns.length > 0 ? `₹${(((debitPaise + creditPaise) / monthTxns.length) / 100).toFixed(2)}` : '₹0.00',
    });
  }

  // Growth calculation
  let growth = null;
  if (monthlyData.length >= 2) {
    const current = monthlyData[0];
    const previous = monthlyData[1];
    const currentTxns = current.total_transactions;
    const prevTxns = previous.total_transactions;
    growth = {
      transaction_count_change: prevTxns > 0 ? `${(((currentTxns - prevTxns) / prevTxns) * 100).toFixed(1)}%` : 'N/A',
      user_count_change: previous.active_users > 0 ? `${(((current.active_users - previous.active_users) / previous.active_users) * 100).toFixed(1)}%` : 'N/A',
    };
  }

  return {
    period: `Last ${months} months`,
    total_users: allUsers.length,
    months: monthlyData,
    growth,
    generated_at: formatIST(now().toISOString()),
  };
}

// ── KYC Expiry Tools ──────────────────────────────────────────────

export function getKycExpiringUsers({ days_ahead = 90, include_expired = false, urgency, sort_by = 'expiry_date' } = {}) {
  const allUsers = [...users.values()];
  const today = now();

  const results = allUsers
    .map(u => {
      // Only MINIMUM KYC users have expiry (365 days from creation)
      if (u.kyc_tier !== 'MINIMUM') return null;
      const created = new Date(u.created_at || today.toISOString());
      const expiry = new Date(created.getTime() + 365 * 24 * 60 * 60 * 1000);
      const daysUntil = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      let urgencyBand;
      if (daysUntil < 0) urgencyBand = 'expired';
      else if (daysUntil <= 7) urgencyBand = 'critical';
      else if (daysUntil <= 30) urgencyBand = 'warning';
      else if (daysUntil <= 90) urgencyBand = 'upcoming';
      else urgencyBand = 'safe';

      return {
        user_id: u.user_id,
        name: u.name,
        phone: u.phone,
        wallet_id: u.wallet_id || u.user_id,
        kyc_tier: u.kyc_tier,
        kyc_state: u.kyc_state,
        wallet_state: u.state || u.wallet_state || 'ACTIVE',
        balance_paise: (u.balance_paise ?? 0n).toString(),
        created_at: formatIST(created.toISOString()),
        expiry_date: formatIST(expiry.toISOString()),
        days_until_expiry: daysUntil,
        urgency: urgencyBand,
        is_expired: daysUntil < 0,
      };
    })
    .filter(u => {
      if (!u) return false;
      if (!include_expired && u.is_expired) return false;
      if (urgency && u.urgency !== urgency) return false;
      if (!include_expired && u.days_until_expiry > days_ahead) return false;
      return true;
    });

  if (sort_by === 'expiry_date') results.sort((a, b) => a.days_until_expiry - b.days_until_expiry);
  else if (sort_by === 'balance') results.sort((a, b) => BigInt(b.balance_paise) > BigInt(a.balance_paise) ? 1 : -1);
  else if (sort_by === 'name') results.sort((a, b) => a.name.localeCompare(b.name));

  const summary = {
    expired: results.filter(u => u.urgency === 'expired').length,
    critical: results.filter(u => u.urgency === 'critical').length,
    warning: results.filter(u => u.urgency === 'warning').length,
    upcoming: results.filter(u => u.urgency === 'upcoming').length,
  };

  return {
    total: results.length,
    summary,
    users: results,
    filters: { days_ahead, include_expired, urgency, sort_by },
    generated_at: formatIST(now().toISOString()),
  };
}

export function queryKycExpiry({ from_date, to_date, kyc_state, wallet_state, min_balance, include_inactive = false, limit = 50, urgency, sort_by = 'expiry_date', include_expired = false } = {}) {
  const allUsers = [...users.values()];
  const today = now();

  const results = allUsers
    .map(u => {
      if (u.kyc_tier !== 'MINIMUM') return null;
      const created = new Date(u.created_at || today.toISOString());
      const expiry = new Date(created.getTime() + 365 * 24 * 60 * 60 * 1000);
      const daysUntil = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

      // Urgency band classification (absorbed from getKycExpiringUsers)
      let urgencyBand;
      if (daysUntil < 0) urgencyBand = 'expired';
      else if (daysUntil <= 7) urgencyBand = 'critical';
      else if (daysUntil <= 30) urgencyBand = 'warning';
      else if (daysUntil <= 90) urgencyBand = 'upcoming';
      else urgencyBand = 'safe';

      return {
        user_id: u.user_id,
        name: u.name,
        phone: u.phone,
        wallet_id: u.wallet_id || u.user_id,
        kyc_tier: u.kyc_tier,
        kyc_state: u.kyc_state,
        wallet_state: u.state || u.wallet_state || 'ACTIVE',
        balance_paise: (u.balance_paise ?? 0n).toString(),
        is_active: (u.state || u.wallet_state || 'ACTIVE') === 'ACTIVE',
        created_at: formatIST(created.toISOString()),
        expiry_date: formatIST(expiry.toISOString()),
        days_until_expiry: daysUntil,
        urgency: urgencyBand,
        is_expired: daysUntil < 0,
        last_activity_at: u.last_activity_at ? formatIST(u.last_activity_at) : null,
      };
    })
    .filter(u => {
      if (!u) return false;
      if (!include_inactive && !u.is_active) return false;
      if (!include_expired && u.is_expired) return false;
      if (urgency && u.urgency !== urgency) return false;
      if (kyc_state && u.kyc_state !== kyc_state) return false;
      if (wallet_state && u.wallet_state !== wallet_state) return false;
      if (min_balance && BigInt(u.balance_paise) < BigInt(min_balance)) return false;
      if (from_date) {
        const fromD = new Date(from_date);
        const expD = new Date(u.expiry_date);
        if (expD < fromD) return false;
      }
      if (to_date) {
        const toD = new Date(to_date);
        const expD = new Date(u.expiry_date);
        if (expD > toD) return false;
      }
      return true;
    });

  // Sort support (absorbed from getKycExpiringUsers)
  if (sort_by === 'balance') results.sort((a, b) => BigInt(b.balance_paise) > BigInt(a.balance_paise) ? 1 : -1);
  else if (sort_by === 'name') results.sort((a, b) => a.name.localeCompare(b.name));
  else results.sort((a, b) => a.days_until_expiry - b.days_until_expiry); // default: expiry_date

  const limited = results.slice(0, limit);

  // Urgency summary (absorbed from getKycExpiringUsers)
  const urgency_summary = {
    expired: results.filter(u => u.urgency === 'expired').length,
    critical: results.filter(u => u.urgency === 'critical').length,
    warning: results.filter(u => u.urgency === 'warning').length,
    upcoming: results.filter(u => u.urgency === 'upcoming').length,
    safe: results.filter(u => u.urgency === 'safe').length,
  };

  const aggregation = {
    total_matched: results.length,
    total_balance_paise: results.reduce((s, u) => s + BigInt(u.balance_paise), 0n).toString(),
    avg_days_to_expiry: results.length > 0 ? Math.round(results.reduce((s, u) => s + u.days_until_expiry, 0) / results.length) : 0,
    urgency_summary,
    by_kyc_state: {},
    by_wallet_state: {},
  };
  results.forEach(u => {
    aggregation.by_kyc_state[u.kyc_state] = (aggregation.by_kyc_state[u.kyc_state] || 0) + 1;
    aggregation.by_wallet_state[u.wallet_state] = (aggregation.by_wallet_state[u.wallet_state] || 0) + 1;
  });

  return {
    query: { from_date, to_date, kyc_state, wallet_state, min_balance, include_inactive, include_expired, urgency, sort_by, limit },
    aggregation,
    results: limited,
    has_more: results.length > limit,
    generated_at: formatIST(now().toISOString()),
  };
}

export function generateKycRenewalReport({ days_ahead = 90, report_format = 'detailed' } = {}) {
  const allUsers = [...users.values()];
  const today = now();

  const minKycUsers = allUsers
    .filter(u => u.kyc_tier === 'MINIMUM')
    .map(u => {
      const created = new Date(u.created_at || today.toISOString());
      const expiry = new Date(created.getTime() + 365 * 24 * 60 * 60 * 1000);
      const daysUntil = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      return { ...u, expiry, daysUntil, balance_str: (u.balance_paise ?? 0n).toString() };
    });

  const expired = minKycUsers.filter(u => u.daysUntil < 0);
  const critical = minKycUsers.filter(u => u.daysUntil >= 0 && u.daysUntil <= 7);
  const warning = minKycUsers.filter(u => u.daysUntil > 7 && u.daysUntil <= 30);
  const upcoming = minKycUsers.filter(u => u.daysUntil > 30 && u.daysUntil <= days_ahead);
  const safe = minKycUsers.filter(u => u.daysUntil > days_ahead);

  const fullKycUsers = allUsers.filter(u => u.kyc_tier === 'FULL');
  const pendingUpgrade = allUsers.filter(u => u.kyc_state === 'FULL_KYC_PENDING');

  const totalAtRisk = expired.length + critical.length + warning.length;
  const atRiskBalance = [...expired, ...critical, ...warning]
    .reduce((s, u) => s + (u.balance_paise ?? 0n), 0n);

  const formatUser = u => ({
    user_id: u.user_id,
    name: u.name,
    phone: u.phone,
    wallet_id: u.wallet_id || u.user_id,
    balance_paise: u.balance_str,
    expiry_date: formatIST(u.expiry.toISOString()),
    days_until_expiry: u.daysUntil,
    wallet_state: u.state || u.wallet_state || 'ACTIVE',
  });

  const report = {
    report_title: 'KYC Renewal Compliance Report',
    report_date: formatIST(today.toISOString()),
    report_period: `Next ${days_ahead} days`,

    executive_summary: {
      total_minimum_kyc_users: minKycUsers.length,
      total_full_kyc_users: fullKycUsers.length,
      pending_upgrades: pendingUpgrade.length,
      users_at_risk: totalAtRisk,
      at_risk_balance_paise: atRiskBalance.toString(),
      compliance_rate: minKycUsers.length > 0
        ? `${(((minKycUsers.length - totalAtRisk) / minKycUsers.length) * 100).toFixed(1)}%`
        : '100%',
    },

    urgency_breakdown: {
      expired: { count: expired.length, users: report_format === 'detailed' ? expired.map(formatUser) : undefined },
      critical_7_days: { count: critical.length, users: report_format === 'detailed' ? critical.map(formatUser) : undefined },
      warning_30_days: { count: warning.length, users: report_format === 'detailed' ? warning.map(formatUser) : undefined },
      upcoming: { count: upcoming.length, users: report_format === 'detailed' ? upcoming.map(formatUser) : undefined },
      safe: { count: safe.length },
    },

    financial_impact: {
      total_at_risk_balance: atRiskBalance.toString(),
      expired_balance: expired.reduce((s, u) => s + (u.balance_paise ?? 0n), 0n).toString(),
      critical_balance: critical.reduce((s, u) => s + (u.balance_paise ?? 0n), 0n).toString(),
      warning_balance: warning.reduce((s, u) => s + (u.balance_paise ?? 0n), 0n).toString(),
    },

    compliance_status: {
      rbi_mandate: 'RBI mandates full KYC within 12 months of wallet activation for MINIMUM KYC users',
      action_required: totalAtRisk > 0,
      risk_level: expired.length > 0 ? 'HIGH' : critical.length > 0 ? 'MEDIUM' : 'LOW',
    },

    recommendations: [
      ...(expired.length > 0 ? [`URGENT: ${expired.length} users have expired KYC — initiate immediate outreach and consider wallet restrictions per RBI guidelines`] : []),
      ...(critical.length > 0 ? [`HIGH PRIORITY: ${critical.length} users expire within 7 days — send SMS + push notification reminders`] : []),
      ...(warning.length > 0 ? [`MODERATE: ${warning.length} users expire within 30 days — begin email + in-app nudge campaigns`] : []),
      ...(upcoming.length > 0 ? [`PROACTIVE: ${upcoming.length} users expire within ${days_ahead} days — schedule renewal reminders`] : []),
      pendingUpgrade.length > 0 ? `${pendingUpgrade.length} users have pending KYC upgrade requests — expedite review` : null,
    ].filter(Boolean),

    generated_at: formatIST(now().toISOString()),
  };

  return report;
}
