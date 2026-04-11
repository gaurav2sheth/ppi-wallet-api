/**
 * KYC Expiry Alert Service
 *
 * Detects users with KYC expiring in 7 days, uses Claude API to draft
 * personalised outreach messages, simulates sending, and generates
 * an ops summary.
 *
 * Usage:
 *   import { runKycAlerts, previewAtRiskUsers } from './kyc-alert-service.js';
 *   const result = await runKycAlerts(apiKey);
 *   const preview = previewAtRiskUsers();
 */

import Anthropic from '@anthropic-ai/sdk';
import { queryKycExpiry } from '../mock-data.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatIST(date = new Date()) {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function paiseToINR(paise) {
  return (Number(paise) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Step 1: Fetch at-risk users ──────────────────────────────────────────────

export function previewAtRiskUsers() {
  console.log('[KYC Alert] Step 1 — Fetching at-risk users (KYC expiring ≤7 days)...');

  const result = queryKycExpiry({
    urgency: 'critical',
    include_expired: false,
    include_inactive: false,
    sort_by: 'expiry_date',
    limit: 200,
  });

  const users = result.results.map(u => ({
    user_id: u.user_id,
    name: u.name,
    phone: u.phone,
    balance: `₹${paiseToINR(u.balance_paise)}`,
    balance_paise: u.balance_paise,
    expiry_date: u.expiry_date,
    days_left: u.days_until_expiry,
    kyc_type: 'MINIMUM KYC',
    wallet_state: u.wallet_state,
  }));

  const totalAtRiskPaise = result.results.reduce(
    (sum, u) => sum + BigInt(u.balance_paise), 0n
  );

  console.log(`[KYC Alert] Found ${users.length} at-risk user(s), total at-risk balance: ₹${paiseToINR(totalAtRiskPaise.toString())}`);

  return {
    users,
    count: users.length,
    total_at_risk_balance: `₹${paiseToINR(totalAtRiskPaise.toString())}`,
    total_at_risk_paise: totalAtRiskPaise.toString(),
    generated_at: formatIST(),
  };
}

// ── Step 2: Generate personalised messages via Claude API ─────────────────────

async function generateAlertMessage(client, user) {
  console.log(`[KYC Alert] Step 2 — Generating message for ${user.name} (${user.user_id})...`);

  const systemPrompt =
    'You are a customer communication specialist for a PPI wallet product in India. ' +
    'Write clear, friendly, and compliant SMS/WhatsApp messages. ' +
    'Keep messages under 160 characters for SMS. ' +
    'Always include the expiry date and a clear call to action.';

  const userPrompt =
    `Draft an alert message for this wallet user whose KYC is expiring soon:\n` +
    `Name: ${user.name}\n` +
    `KYC Expiry: ${user.expiry_date}\n` +
    `Days Left: ${user.days_left}\n` +
    `At-risk Balance: ${user.balance}\n\n` +
    `The message should:\n` +
    `- Address them by first name\n` +
    `- Mention exact expiry date\n` +
    `- Mention their balance is at risk of freeze\n` +
    `- Ask them to complete Full KYC\n` +
    `- Include urgency without being alarming\n` +
    `- End with: 'Reply HELP for assistance'`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const message = textBlock ? textBlock.text.trim() : 'KYC expiry alert — please complete Full KYC. Reply HELP for assistance.';
    console.log(`[KYC Alert]   ✅ Message generated for ${user.name} (${message.length} chars)`);
    return message;
  } catch (err) {
    console.error(`[KYC Alert]   ❌ Claude API failed for ${user.name}: ${err?.message || err}`);
    // Graceful fallback — continue processing other users
    return `Hi ${user.name.split(' ')[0]}, your KYC expires on ${user.expiry_date}. ` +
      `Your balance of ${user.balance} may be frozen. Complete Full KYC now. Reply HELP for assistance`;
  }
}

// ── Step 3: Simulate sending ─────────────────────────────────────────────────

function simulateSend(alert) {
  console.log('================================');
  console.log(`📱 SMS ALERT — User: ${alert.name}`);
  console.log(`📞 Phone: ${alert.phone}`);
  console.log(`⏰ KYC Expires: ${alert.expiry_date} (${alert.days_left} days)`);
  console.log(`💰 At-risk Balance: ${alert.balance}`);
  console.log('');
  console.log('MESSAGE:');
  console.log(alert.message);
  console.log('');
  console.log('STATUS: Sent (simulated)');
  console.log('================================');
}

// ── Step 4: Generate ops summary via Claude API ──────────────────────────────

async function generateOpsSummary(client, alerts, totalBalance) {
  console.log('[KYC Alert] Step 4 — Generating ops summary...');

  const breakdown = {};
  alerts.forEach(a => {
    const key = `${a.days_left} day(s)`;
    breakdown[key] = (breakdown[key] || 0) + 1;
  });
  const breakdownStr = Object.entries(breakdown)
    .map(([k, v]) => `${v} user(s) with ${k} left`)
    .join(', ');

  const prompt =
    `Summarise this KYC alert run for the ops team:\n` +
    `Total users alerted: ${alerts.length}\n` +
    `Total at-risk balance: ${totalBalance}\n` +
    `Users by days left: ${breakdownStr}\n\n` +
    `Write a 3-line ops summary suitable for a Slack notification to the compliance team.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: 'You are an operations analyst for a PPI wallet company in India. Be concise and data-driven.',
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    const summary = textBlock ? textBlock.text.trim() : 'KYC alert run completed.';
    console.log(`[KYC Alert]   ✅ Ops summary generated`);
    return summary;
  } catch (err) {
    console.error(`[KYC Alert]   ❌ Summary generation failed: ${err?.message || err}`);
    return `KYC Alert Run: ${alerts.length} user(s) alerted. At-risk balance: ${totalBalance}. Breakdown: ${breakdownStr}.`;
  }
}

// ── Main orchestrator ────────────────────────────────────────────────────────

export async function runKycAlerts(apiKey) {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          KYC EXPIRY ALERT SERVICE — RUN             ║');
  console.log(`║  ${formatIST().padEnd(50)}  ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required');
  }

  const client = new Anthropic({ apiKey });

  // Step 1 — Fetch at-risk users
  const preview = previewAtRiskUsers();

  if (preview.count === 0) {
    console.log('[KYC Alert] ✅ No at-risk users found. All clear!');
    return {
      run_at: formatIST(),
      users_alerted: 0,
      total_at_risk_balance: '₹0.00',
      alerts: [],
      ops_summary: 'No users with KYC expiring in 7 days. No action needed.',
    };
  }

  // Step 2 — Generate personalised messages
  const alerts = [];
  for (const user of preview.users) {
    const message = await generateAlertMessage(client, user);
    alerts.push({
      user_id: user.user_id,
      name: user.name,
      phone: user.phone,
      days_left: user.days_left,
      balance: user.balance,
      expiry_date: user.expiry_date,
      message,
      generated_at: formatIST(),
      status: 'sent',
    });
  }

  // Step 3 — Simulate sending
  console.log('\n[KYC Alert] Step 3 — Simulating message delivery...\n');
  alerts.forEach(simulateSend);

  // Step 4 — Generate ops summary
  const opsSummary = await generateOpsSummary(client, alerts, preview.total_at_risk_balance);

  console.log('\n[KYC Alert] 📋 OPS SUMMARY:');
  console.log(opsSummary);
  console.log('\n[KYC Alert] ✅ Alert run complete.\n');

  return {
    run_at: formatIST(),
    users_alerted: alerts.length,
    total_at_risk_balance: preview.total_at_risk_balance,
    alerts,
    ops_summary: opsSummary,
  };
}
