/**
 * KYC Upgrade Agent — Autonomous AI Agent for PPI Wallet
 *
 * Follows the PERCEIVE → REASON → PLAN → ACT → OBSERVE → REPEAT loop
 * to detect at-risk KYC users, decide intervention strategy via Claude API,
 * draft personalised outreach, and handle follow-ups/escalations.
 *
 * Usage:
 *   import { runKycUpgradeAgent } from './kyc-upgrade-agent.js';
 *   const result = await runKycUpgradeAgent(apiKey);
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  queryKycExpiry,
  getWalletBalance,
  getTransactionHistory,
  getSubWalletData,
  getUserProfile,
  getNotifications,
  listUsers,
} from '../mock-data.js';
import { escalateToOps } from './escalation-manager.js';

// ── Module-level stores ──────────────────────────────────────────────────────
const agentRunHistory = [];    // last 10 runs
const activeNotifications = []; // all created notifications

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatIST(date = new Date()) {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function formatPaise(paise) {
  const rupees = Number(paise) / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Step 1: PERCEIVE — Gather at-risk user contexts ─────────────────────────

export function perceiveAtRiskUsers() {
  console.log('[KYC Agent] Step 1 — PERCEIVE: Scanning for at-risk users (KYC expiring ≤7 days)...');
  const auditLog = [];

  auditLog.push({ timestamp: formatIST(), step: 'PERCEIVE_START', detail: 'Querying KYC expiry data' });

  const expiryResult = queryKycExpiry({
    urgency: 'critical',
    include_expired: false,
    include_inactive: false,
    sort_by: 'expiry_date',
    limit: 200,
  });

  const atRiskUsers = expiryResult.results;
  auditLog.push({ timestamp: formatIST(), step: 'PERCEIVE_EXPIRY_QUERY', detail: `Found ${atRiskUsers.length} user(s) with KYC expiring in ≤7 days` });

  if (atRiskUsers.length === 0) {
    console.log('[KYC Agent]   No at-risk users found.');
    return { userContexts: [], auditLog };
  }

  const userContexts = [];

  for (const user of atRiskUsers) {
    try {
      // a. Wallet balance
      const balanceData = getWalletBalance(user.user_id);
      const mainBalancePaise = balanceData ? Number(balanceData.balance_paise) : 0;
      const kycType = balanceData ? balanceData.kyc_tier : 'MINIMUM';
      const walletStatus = balanceData ? balanceData.status : 'UNKNOWN';

      // b. Transaction history (last 30 days)
      const txnData = getTransactionHistory(user.user_id, 30, { limit: 500 });
      const txnCount = txnData ? txnData.total_matching : 0;
      const totalTxnAmountPaise = txnData
        ? txnData.transactions.reduce((sum, t) => sum + Number(t.amount_paise), 0)
        : 0;
      const lastTxnDate = txnData && txnData.transactions.length > 0
        ? txnData.transactions[0].timestamp
        : null;

      // c. Sub-wallet data
      let subWalletBalances = [];
      let subWalletTotalPaise = 0;
      try {
        const subWallets = getSubWalletData(user.user_id);
        if (subWallets && Array.isArray(subWallets)) {
          subWalletBalances = subWallets.map(sw => ({
            type: sw.type,
            label: sw.label,
            balance_paise: Number(sw.balance_paise || 0),
          }));
          subWalletTotalPaise = subWalletBalances.reduce((sum, sw) => sum + sw.balance_paise, 0);
        }
      } catch (_err) {
        // Sub-wallet data not available — skip gracefully
      }

      // d. User profile
      const profile = getUserProfile(user.user_id);

      // Derived fields
      const totalAtRiskPaise = mainBalancePaise + subWalletTotalPaise;
      const daysUntilExpiry = user.days_until_expiry;

      let activityScore;
      if (txnCount > 10) activityScore = 'HIGH';
      else if (txnCount >= 4) activityScore = 'MEDIUM';
      else if (txnCount >= 1) activityScore = 'LOW';
      else activityScore = 'DORMANT';

      const isHighValue = totalAtRiskPaise > 500000; // ₹5,000 in paise

      const ctx = {
        user_id: user.user_id,
        name: user.name,
        phone: user.phone,
        kyc_type: kycType,
        wallet_status: walletStatus,
        main_balance_paise: mainBalancePaise,
        main_balance_display: formatPaise(mainBalancePaise),
        sub_wallets: subWalletBalances,
        sub_wallet_total_paise: subWalletTotalPaise,
        total_at_risk_paise: totalAtRiskPaise,
        total_at_risk_display: formatPaise(totalAtRiskPaise),
        expiry_date: user.expiry_date,
        days_until_expiry: daysUntilExpiry,
        txn_count_30d: txnCount,
        total_txn_amount_30d_paise: totalTxnAmountPaise,
        last_txn_date: lastTxnDate,
        activity_score: activityScore,
        is_high_value: isHighValue,
        profile_name: profile ? profile.name : user.name,
        profile_phone: profile ? profile.phone : user.phone,
        account_age_days: profile ? profile.account_age_days : null,
      };

      userContexts.push(ctx);
      auditLog.push({ timestamp: formatIST(), step: 'PERCEIVE_USER', detail: `Gathered context for ${user.name} (${user.user_id}): ${activityScore} activity, ${formatPaise(totalAtRiskPaise)} at risk, ${daysUntilExpiry}d left` });
    } catch (err) {
      auditLog.push({ timestamp: formatIST(), step: 'PERCEIVE_USER_ERROR', detail: `Failed to gather context for ${user.user_id}: ${err.message}` });
      console.error(`[KYC Agent]   Error gathering context for ${user.user_id}: ${err.message}`);
    }
  }

  console.log(`[KYC Agent]   Perceived ${userContexts.length} user(s) with full context.`);
  return { userContexts, auditLog };
}

// ── Step 2: REASON — AI-powered decision making ─────────────────────────────

export async function reasonAboutUsers(userContexts, apiKey) {
  console.log(`[KYC Agent] Step 2 — REASON: Deciding intervention strategy for ${userContexts.length} user(s)...`);
  const auditLog = [];

  if (userContexts.length === 0) {
    return { decisions: [], auditLog };
  }

  // Try Claude API first
  if (apiKey) {
    try {
      const client = new Anthropic({ apiKey });

      const systemPrompt =
        'You are an autonomous KYC compliance agent for a PPI wallet regulated by RBI India. ' +
        'For each user, assess urgency, engagement, decide intervention strategy, and personalise approach. ' +
        'Always respond with valid JSON only.';

      const userPrompt =
        `Analyse these at-risk users whose KYC is expiring soon and decide the intervention strategy for each.\n\n` +
        `User contexts:\n${JSON.stringify(userContexts, null, 2)}\n\n` +
        `For EACH user, return a JSON array of decisions with these fields:\n` +
        `- user_id: string\n` +
        `- priority: "P1_CRITICAL" | "P2_HIGH" | "P3_MEDIUM" | "P4_LOW"\n` +
        `- priority_reason: string (1 line)\n` +
        `- intervention_strategy: "URGENT_MULTI_TOUCH" | "STANDARD_OUTREACH" | "GENTLE_REMINDER" | "MONITOR_ONLY"\n` +
        `- message_tone: "URGENT" | "FRIENDLY" | "INFORMATIONAL"\n` +
        `- key_motivator: "BALANCE_AT_RISK" | "BENEFITS_EXPIRY" | "HABIT_CONTINUITY" | "COMPLIANCE"\n` +
        `- suggested_offer: "NONE" | "CASHBACK_50" | "CASHBACK_100" | "BONUS_SCRATCH_CARD"\n` +
        `- follow_up_hours: 24 | 48 | 72\n` +
        `- escalate_immediately: boolean\n` +
        `- escalation_reason: string | null\n` +
        `- agent_reasoning: string (2-3 lines explaining your decision)\n\n` +
        `Consider:\n` +
        `- days_until_expiry (lower = more urgent)\n` +
        `- total_at_risk_paise (higher = higher priority)\n` +
        `- activity_score (HIGH users are more likely to respond)\n` +
        `- is_high_value (>₹5,000 at risk needs special attention)\n\n` +
        `Return ONLY the JSON array, no markdown or explanation.`;

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock) {
        const jsonText = textBlock.text.trim();
        const decisions = JSON.parse(jsonText);
        auditLog.push({ timestamp: formatIST(), step: 'REASON_AI', detail: `Claude API returned ${decisions.length} decision(s)` });
        console.log(`[KYC Agent]   Claude API returned ${decisions.length} decision(s).`);
        return { decisions, auditLog };
      }
    } catch (err) {
      console.error(`[KYC Agent]   Claude API failed for reasoning: ${err?.message || err}`);
      auditLog.push({ timestamp: formatIST(), step: 'REASON_AI_FALLBACK', detail: `Claude API failed: ${err?.message || err}. Using rule-based fallback.` });
    }
  }

  // Rule-based fallback
  console.log('[KYC Agent]   Using rule-based fallback for reasoning...');
  const decisions = userContexts.map(ctx => {
    let priority, intervention_strategy, message_tone, follow_up_hours, escalate_immediately, escalation_reason, suggested_offer;

    if (ctx.days_until_expiry <= 2 || ctx.total_at_risk_paise > 5000000) {
      priority = 'P1_CRITICAL';
      intervention_strategy = 'URGENT_MULTI_TOUCH';
      message_tone = 'URGENT';
      follow_up_hours = 24;
      escalate_immediately = true;
      escalation_reason = ctx.days_until_expiry <= 2
        ? `KYC expires in ${ctx.days_until_expiry} day(s)`
        : `High balance at risk: ${formatPaise(ctx.total_at_risk_paise)}`;
      suggested_offer = 'CASHBACK_100';
    } else if (ctx.days_until_expiry <= 4 || ctx.total_at_risk_paise > 1000000) {
      priority = 'P2_HIGH';
      intervention_strategy = 'STANDARD_OUTREACH';
      message_tone = 'URGENT';
      follow_up_hours = 48;
      escalate_immediately = false;
      escalation_reason = null;
      suggested_offer = 'CASHBACK_50';
    } else if (ctx.days_until_expiry <= 6 && (ctx.activity_score === 'HIGH' || ctx.activity_score === 'MEDIUM')) {
      priority = 'P3_MEDIUM';
      intervention_strategy = 'GENTLE_REMINDER';
      message_tone = 'FRIENDLY';
      follow_up_hours = 72;
      escalate_immediately = false;
      escalation_reason = null;
      suggested_offer = 'BONUS_SCRATCH_CARD';
    } else {
      priority = 'P4_LOW';
      intervention_strategy = 'MONITOR_ONLY';
      message_tone = 'INFORMATIONAL';
      follow_up_hours = 72;
      escalate_immediately = false;
      escalation_reason = null;
      suggested_offer = 'NONE';
    }

    return {
      user_id: ctx.user_id,
      priority,
      priority_reason: `${ctx.days_until_expiry}d to expiry, ${formatPaise(ctx.total_at_risk_paise)} at risk, ${ctx.activity_score} activity`,
      intervention_strategy,
      message_tone,
      key_motivator: ctx.is_high_value ? 'BALANCE_AT_RISK' : 'COMPLIANCE',
      suggested_offer,
      follow_up_hours,
      escalate_immediately,
      escalation_reason,
      agent_reasoning: `Rule-based: ${ctx.days_until_expiry} days left, ${formatPaise(ctx.total_at_risk_paise)} balance at risk, activity=${ctx.activity_score}. ${intervention_strategy} selected based on urgency and value thresholds.`,
    };
  });

  auditLog.push({ timestamp: formatIST(), step: 'REASON_FALLBACK', detail: `Rule-based fallback produced ${decisions.length} decision(s)` });
  return { decisions, auditLog };
}

// ── Step 3: PLAN — Build execution plan ─────────────────────────────────────

export function buildExecutionPlan(userContexts, decisions) {
  console.log(`[KYC Agent] Step 3 — PLAN: Building execution plan for ${decisions.length} user(s)...`);

  const priorityOrder = { P1_CRITICAL: 0, P2_HIGH: 1, P3_MEDIUM: 2, P4_LOW: 3 };

  const plans = decisions.map(decision => {
    const ctx = userContexts.find(u => u.user_id === decision.user_id) || {};

    const actions = [];

    // SMS — immediate for all strategies except MONITOR_ONLY
    if (decision.intervention_strategy !== 'MONITOR_ONLY') {
      actions.push({ type: 'SEND_SMS', timing: 'immediate' });
      actions.push({ type: 'SEND_IN_APP', timing: 'immediate' });
    }

    // Follow-up SMS
    if (decision.intervention_strategy !== 'MONITOR_ONLY') {
      actions.push({ type: 'FOLLOW_UP_SMS', timing: `after_${decision.follow_up_hours}h` });
    }

    // Escalation
    if (decision.escalate_immediately) {
      actions.push({ type: 'ESCALATE_TO_OPS', timing: 'immediate' });
    } else if (decision.intervention_strategy !== 'MONITOR_ONLY') {
      actions.push({ type: 'ESCALATE_TO_OPS', timing: 'after_followup' });
    }

    return {
      user_id: decision.user_id,
      name: ctx.name || decision.user_id,
      phone: ctx.phone || 'N/A',
      priority: decision.priority,
      intervention_strategy: decision.intervention_strategy,
      message_tone: decision.message_tone,
      key_motivator: decision.key_motivator,
      suggested_offer: decision.suggested_offer,
      follow_up_hours: decision.follow_up_hours,
      escalate_immediately: decision.escalate_immediately,
      escalation_reason: decision.escalation_reason,
      agent_reasoning: decision.agent_reasoning,
      total_at_risk_paise: ctx.total_at_risk_paise || 0,
      total_at_risk_display: ctx.total_at_risk_display || formatPaise(0),
      days_until_expiry: ctx.days_until_expiry || 0,
      expiry_date: ctx.expiry_date || 'N/A',
      sub_wallets: ctx.sub_wallets || [],
      actions,
    };
  });

  // Sort by priority: P1 first, P4 last
  plans.sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));

  console.log(`[KYC Agent]   Execution plan built: ${plans.map(p => `${p.name}(${p.priority})`).join(', ')}`);
  return plans;
}

// ── Step 4: ACT — Execute outreach ──────────────────────────────────────────

export async function executeOutreach(executionPlans, apiKey) {
  console.log(`[KYC Agent] Step 4 — ACT: Executing outreach for ${executionPlans.length} user(s)...`);
  const runLog = [];
  let client = null;

  if (apiKey) {
    try {
      client = new Anthropic({ apiKey });
    } catch (_err) {
      client = null;
    }
  }

  for (const plan of executionPlans) {
    try {
      // Skip MONITOR_ONLY — no outreach needed
      if (plan.intervention_strategy === 'MONITOR_ONLY') {
        runLog.push({
          user_id: plan.user_id,
          name: plan.name,
          priority: plan.priority,
          strategy: plan.intervention_strategy,
          sms_sent: false,
          in_app_sent: false,
          escalated: false,
          note: 'MONITOR_ONLY — no outreach',
          timestamp: formatIST(),
        });
        continue;
      }

      // A. Draft SMS
      let smsMessage;
      try {
        if (client) {
          const smsResponse = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 256,
            system: 'Write SMS messages for a PPI wallet in India. Max 160 chars. Clear, compliant, drive action.',
            messages: [{
              role: 'user',
              content: `Draft an SMS for this user:\n` +
                `Name: ${plan.name}\n` +
                `Expiry date: ${plan.expiry_date}\n` +
                `Days left: ${plan.days_until_expiry}\n` +
                `Total at risk: ${plan.total_at_risk_display}\n` +
                `Sub-wallets: ${plan.sub_wallets.map(sw => `${sw.label}: ${formatPaise(sw.balance_paise)}`).join(', ') || 'None'}\n` +
                `Tone: ${plan.message_tone}\n` +
                `Key motivator: ${plan.key_motivator}\n` +
                `Offer: ${plan.suggested_offer}\n\n` +
                `Must end with: "Tap to upgrade: [LINK]"\n` +
                `Max 160 characters. Return only the SMS text.`,
            }],
          });
          const textBlock = smsResponse.content.find(b => b.type === 'text');
          smsMessage = textBlock ? textBlock.text.trim() : null;
        }
      } catch (_err) {
        smsMessage = null;
      }

      // SMS fallback
      if (!smsMessage) {
        const firstName = plan.name.split(' ')[0];
        smsMessage = `Hi ${firstName}, your KYC expires on ${plan.expiry_date}. ${plan.total_at_risk_display} at risk. Upgrade now: [LINK]`;
      }

      // B. Draft in-app notification
      let inAppNotification;
      try {
        if (client) {
          const inAppResponse = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 256,
            system: 'Write in-app notifications for a PPI wallet. Return ONLY valid JSON with fields: title (max 50 chars), body (max 100 chars), cta_button (max 20 chars). No markdown.',
            messages: [{
              role: 'user',
              content: `Draft an in-app notification:\n` +
                `Name: ${plan.name}\n` +
                `Days left: ${plan.days_until_expiry}\n` +
                `Balance at risk: ${plan.total_at_risk_display}\n` +
                `Tone: ${plan.message_tone}\n` +
                `Return ONLY JSON: {"title": "...", "body": "...", "cta_button": "..."}`,
            }],
          });
          const textBlock = inAppResponse.content.find(b => b.type === 'text');
          if (textBlock) {
            inAppNotification = JSON.parse(textBlock.text.trim());
          }
        }
      } catch (_err) {
        inAppNotification = null;
      }

      // In-app fallback
      if (!inAppNotification) {
        inAppNotification = {
          title: `KYC Expires in ${plan.days_until_expiry} Day(s)`,
          body: `Your balance of ${plan.total_at_risk_display} may be frozen. Complete Full KYC now.`,
          cta_button: 'Upgrade KYC',
        };
      }

      // C. Console log SMS dispatch
      console.log('');
      console.log('┌─────────────────────────────────────┐');
      console.log('│ 📱 SMS DISPATCHED                   │');
      console.log(`│ To: ${plan.name} (${plan.phone})`);
      console.log(`│ Priority: ${plan.priority}`);
      console.log(`│ Strategy: ${plan.intervention_strategy}`);
      console.log('│                                     │');
      console.log('│ MESSAGE:                            │');
      console.log(`│ ${smsMessage}`);
      console.log('│                                     │');
      console.log(`│ Offer: ${plan.suggested_offer}`);
      console.log(`│ Follow-up in: ${plan.follow_up_hours}hrs`);
      console.log('└─────────────────────────────────────┘');
      console.log('');

      // D. Create notification record
      const notification = {
        notification_id: `NOTIF-${Date.now()}-${plan.user_id}`,
        user_id: plan.user_id,
        type: 'KYC_UPGRADE_ALERT',
        title: inAppNotification.title,
        body: inAppNotification.body,
        cta_button: inAppNotification.cta_button,
        created_at: formatIST(),
        read: false,
        action_taken: false,
      };
      activeNotifications.push(notification);

      // Handle immediate escalation
      let escalated = false;
      if (plan.escalate_immediately) {
        escalateToOps(plan.user_id, {
          name: plan.name,
          phone: plan.phone,
          priority: plan.priority,
          days_until_expiry: plan.days_until_expiry,
          total_at_risk: plan.total_at_risk_display,
          escalation_reason: plan.escalation_reason,
          outreach_attempts: 1,
          agent_reasoning: plan.agent_reasoning,
          recommended_action: 'Immediate manual outreach — KYC expiry imminent or high-value account',
        });
        escalated = true;
        console.log(`[KYC Agent]   ⚠️  Escalated ${plan.name} to ops: ${plan.escalation_reason}`);
      }

      // E. Log to run log
      runLog.push({
        user_id: plan.user_id,
        name: plan.name,
        priority: plan.priority,
        strategy: plan.intervention_strategy,
        sms_sent: true,
        sms_message: smsMessage,
        in_app_sent: true,
        in_app_notification: inAppNotification,
        notification_id: notification.notification_id,
        escalated,
        offer: plan.suggested_offer,
        follow_up_hours: plan.follow_up_hours,
        timestamp: formatIST(),
      });
    } catch (err) {
      console.error(`[KYC Agent]   Error executing outreach for ${plan.user_id}: ${err.message}`);
      runLog.push({
        user_id: plan.user_id,
        name: plan.name,
        priority: plan.priority,
        strategy: plan.intervention_strategy,
        sms_sent: false,
        in_app_sent: false,
        escalated: false,
        error: err.message,
        timestamp: formatIST(),
      });
    }
  }

  console.log(`[KYC Agent]   Outreach complete: ${runLog.filter(r => r.sms_sent).length}/${executionPlans.length} SMS sent.`);
  return runLog;
}

// ── Step 5: OBSERVE — Check user responses ──────────────────────────────────

export function observeUserResponse(userId) {
  console.log(`[KYC Agent] Step 5 — OBSERVE: Checking response for ${userId}...`);

  // Simulate responses for testing
  const rand = Math.random();
  const kycUpgraded = rand < 0.2;           // 20% chance upgraded
  const notificationRead = rand < 0.5;       // 50% chance read
  const ctaTapped = notificationRead && rand < 0.3; // 30% chance if read

  let responseStatus;
  if (kycUpgraded) responseStatus = 'UPGRADED';
  else if (ctaTapped) responseStatus = 'CTA_TAPPED_NO_UPGRADE';
  else if (notificationRead) responseStatus = 'READ_NO_ACTION';
  else responseStatus = 'UNREAD';

  const result = {
    user_id: userId,
    kyc_upgraded: kycUpgraded,
    notification_read: notificationRead,
    cta_tapped: ctaTapped,
    response_status: responseStatus,
    observed_at: formatIST(),
  };

  console.log(`[KYC Agent]   ${userId} response: ${responseStatus}`);
  return result;
}

// ── Step 6: FOLLOW-UP / ESCALATION ──────────────────────────────────────────

export async function handleFollowUpOrEscalation(userId, observeResult, actionPlan, apiKey) {
  console.log(`[KYC Agent] Step 6 — FOLLOW-UP: Handling response for ${userId} (${observeResult.response_status})...`);
  const actions = [];

  if (observeResult.response_status === 'UPGRADED') {
    // Resolved — mark case closed
    console.log(`[KYC Agent]   ${userId} has upgraded KYC. Case closed.`);
    actions.push({ type: 'CASE_CLOSED', detail: 'User upgraded KYC successfully' });

    // If offer was given, log reward trigger
    if (actionPlan && actionPlan.suggested_offer && actionPlan.suggested_offer !== 'NONE') {
      actions.push({ type: 'TRIGGER_REWARD', detail: `Offer ${actionPlan.suggested_offer} to be credited` });
      console.log(`[KYC Agent]   Reward triggered: ${actionPlan.suggested_offer}`);
    }

    return { user_id: userId, status: 'RESOLVED', actions };
  }

  if (observeResult.response_status === 'CTA_TAPPED_NO_UPGRADE') {
    // User showed interest but didn't complete — send follow-up
    const firstName = actionPlan ? actionPlan.name.split(' ')[0] : 'User';
    const followUpSms = `Hi ${firstName}, we noticed you started your KYC upgrade. Complete it now to keep your wallet active. Tap to continue: [LINK]`;
    actions.push({ type: 'FOLLOW_UP_SMS', message: followUpSms });
    console.log(`[KYC Agent]   Sent follow-up SMS to ${userId} (CTA tapped but not completed).`);
    return { user_id: userId, status: 'FOLLOW_UP_SENT', actions };
  }

  if (observeResult.response_status === 'READ_NO_ACTION') {
    // User read but took no action — send stronger SMS
    const firstName = actionPlan ? actionPlan.name.split(' ')[0] : 'User';
    const daysLeft = actionPlan ? actionPlan.days_until_expiry : '?';
    const atRisk = actionPlan ? actionPlan.total_at_risk_display : 'your balance';
    const strongSms = `${firstName}, only ${daysLeft} day(s) left! ${atRisk} will be frozen if KYC is not upgraded. Act now: [LINK]`;
    actions.push({ type: 'STRONG_SMS', message: strongSms });

    // Escalate P1/P2 immediately
    if (actionPlan && (actionPlan.priority === 'P1_CRITICAL' || actionPlan.priority === 'P2_HIGH')) {
      escalateToOps(userId, {
        name: actionPlan.name,
        phone: actionPlan.phone,
        priority: actionPlan.priority,
        days_until_expiry: actionPlan.days_until_expiry,
        total_at_risk: actionPlan.total_at_risk_display,
        escalation_reason: 'User read notification but took no action — high priority',
        outreach_attempts: 2,
        agent_reasoning: actionPlan.agent_reasoning,
        recommended_action: 'Call the user directly',
      });
      actions.push({ type: 'ESCALATED', detail: 'P1/P2 user read but no action — escalated to ops' });
      console.log(`[KYC Agent]   Escalated ${userId} to ops (read, no action, ${actionPlan.priority}).`);
    }

    return { user_id: userId, status: 'STRONGER_OUTREACH', actions };
  }

  // UNREAD
  if (actionPlan && actionPlan.days_until_expiry <= 2) {
    // Critical — escalate immediately
    escalateToOps(userId, {
      name: actionPlan.name,
      phone: actionPlan.phone,
      priority: actionPlan.priority,
      days_until_expiry: actionPlan.days_until_expiry,
      total_at_risk: actionPlan.total_at_risk_display,
      escalation_reason: 'Notification unread with ≤2 days to expiry',
      outreach_attempts: 1,
      agent_reasoning: actionPlan.agent_reasoning,
      recommended_action: 'Urgent manual call required',
    });
    actions.push({ type: 'ESCALATED', detail: 'Unread, ≤2 days left — escalated to ops' });
    console.log(`[KYC Agent]   Escalated ${userId} — unread, ≤2 days left.`);
  } else {
    actions.push({ type: 'SCHEDULE_RETRY', detail: 'Notification unread — will retry later' });
    console.log(`[KYC Agent]   Scheduling retry for ${userId} — notification unread.`);
  }

  // Always escalate high-balance users who haven't responded
  if (actionPlan && actionPlan.total_at_risk_paise > 5000000 && !observeResult.kyc_upgraded) {
    escalateToOps(userId, {
      name: actionPlan.name,
      phone: actionPlan.phone,
      priority: actionPlan.priority,
      days_until_expiry: actionPlan.days_until_expiry,
      total_at_risk: actionPlan.total_at_risk_display,
      escalation_reason: 'High-value account (>₹50,000) not upgraded',
      outreach_attempts: 1,
      agent_reasoning: actionPlan.agent_reasoning,
      recommended_action: 'Priority manual outreach for high-value account',
    });
    actions.push({ type: 'ESCALATED', detail: 'High-value account — escalated to ops' });
  }

  return { user_id: userId, status: 'PENDING', actions };
}

// ── Step 7: SUMMARY — Generate ops summary ──────────────────────────────────

export async function generateAgentSummary(runLog, apiKey) {
  console.log('[KYC Agent] Step 7 — SUMMARY: Generating agent run summary...');

  const startedAt = runLog.length > 0 ? runLog[0].timestamp : formatIST();
  const completedAt = formatIST();
  const smsSent = runLog.filter(r => r.sms_sent).length;
  const inAppSent = runLog.filter(r => r.in_app_sent).length;
  const escalated = runLog.filter(r => r.escalated).length;
  const offersDeployed = runLog.filter(r => r.offer && r.offer !== 'NONE').map(r => ({ user_id: r.user_id, offer: r.offer }));

  const statsPrompt =
    `KYC Upgrade Agent run completed.\n` +
    `Users processed: ${runLog.length}\n` +
    `SMS sent: ${smsSent}\n` +
    `In-app notifications: ${inAppSent}\n` +
    `Escalations: ${escalated}\n` +
    `Offers deployed: ${offersDeployed.length}\n` +
    `Priority breakdown: ${['P1_CRITICAL', 'P2_HIGH', 'P3_MEDIUM', 'P4_LOW'].map(p => `${p}: ${runLog.filter(r => r.priority === p).length}`).join(', ')}\n\n` +
    `Write a 4-line ops summary suitable for a Slack notification to the compliance team.`;

  let summary;
  try {
    if (apiKey) {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system: 'You are an operations analyst for a PPI wallet company in India. Be concise and data-driven.',
        messages: [{ role: 'user', content: statsPrompt }],
      });
      const textBlock = response.content.find(b => b.type === 'text');
      summary = textBlock ? textBlock.text.trim() : null;
    }
  } catch (err) {
    console.error(`[KYC Agent]   Summary generation failed: ${err?.message || err}`);
  }

  if (!summary) {
    summary = `KYC Upgrade Agent: ${runLog.length} user(s) processed. ${smsSent} SMS sent, ${inAppSent} in-app notifications. ${escalated} escalation(s). ${offersDeployed.length} offer(s) deployed.`;
  }

  return {
    run_id: `AGENT-RUN-${Date.now()}`,
    started_at: startedAt,
    completed_at: completedAt,
    duration_seconds: 1,
    users_processed: runLog.length,
    decisions: runLog.map(r => ({ user_id: r.user_id, priority: r.priority, strategy: r.strategy })),
    actions_taken: runLog.map(r => ({ user_id: r.user_id, sms: r.sms_sent, in_app: r.in_app_sent, escalated: r.escalated })),
    escalations: runLog.filter(r => r.escalated).map(r => ({ user_id: r.user_id, name: r.name, priority: r.priority })),
    offers_deployed: offersDeployed,
    summary,
    total_balance_protected: formatPaise(0),
  };
}

// ── Main Orchestrator ────────────────────────────────────────────────────────

export async function runKycUpgradeAgent(apiKey) {
  const runStartTime = Date.now();

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       KYC UPGRADE AGENT — AUTONOMOUS RUN               ║');
  console.log(`║  ${formatIST().padEnd(54)}  ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // Step 1: PERCEIVE
    const { userContexts, auditLog: perceiveLog } = perceiveAtRiskUsers();

    if (userContexts.length === 0) {
      console.log('[KYC Agent] No at-risk users found. Agent run complete.');
      return {
        run_id: `AGENT-RUN-${Date.now()}`,
        started_at: formatIST(new Date(runStartTime)),
        completed_at: formatIST(),
        duration_seconds: Math.round((Date.now() - runStartTime) / 1000),
        users_processed: 0,
        decisions: [],
        actions_taken: [],
        escalations: [],
        offers_deployed: [],
        summary: 'No users with KYC expiring in 7 days. No action needed.',
        total_balance_protected: formatPaise(0),
      };
    }

    // Step 2: REASON
    const { decisions, auditLog: reasonLog } = await reasonAboutUsers(userContexts, apiKey);

    // Step 3: PLAN
    const executionPlans = buildExecutionPlan(userContexts, decisions);

    // Step 4: ACT
    const runLog = await executeOutreach(executionPlans, apiKey);

    // Step 5: OBSERVE
    const observations = [];
    for (const plan of executionPlans) {
      const obs = observeUserResponse(plan.user_id);
      observations.push(obs);
    }

    // Step 6: FOLLOW-UP
    for (const obs of observations) {
      const plan = executionPlans.find(p => p.user_id === obs.user_id);
      await handleFollowUpOrEscalation(obs.user_id, obs, plan, apiKey);
    }

    // Step 7: SUMMARY
    const result = await generateAgentSummary(runLog, apiKey);
    result.started_at = formatIST(new Date(runStartTime));
    result.completed_at = formatIST();
    result.duration_seconds = Math.round((Date.now() - runStartTime) / 1000);

    // Calculate total balance protected
    const totalProtectedPaise = userContexts.reduce((sum, ctx) => sum + ctx.total_at_risk_paise, 0);
    result.total_balance_protected = formatPaise(totalProtectedPaise);

    // Store run in history (keep last 10)
    agentRunHistory.push(result);
    if (agentRunHistory.length > 10) agentRunHistory.shift();

    console.log('\n[KYC Agent] 📋 OPS SUMMARY:');
    console.log(result.summary);
    console.log(`\n[KYC Agent] ✅ Agent run complete. ${result.users_processed} user(s) processed in ${result.duration_seconds}s.\n`);

    return result;
  } catch (err) {
    console.error(`[KYC Agent] ❌ Agent run failed: ${err.message}`);
    const errorResult = {
      run_id: `AGENT-RUN-${Date.now()}`,
      started_at: formatIST(new Date(runStartTime)),
      completed_at: formatIST(),
      duration_seconds: Math.round((Date.now() - runStartTime) / 1000),
      users_processed: 0,
      decisions: [],
      actions_taken: [],
      escalations: [],
      offers_deployed: [],
      summary: `Agent run failed: ${err.message}`,
      total_balance_protected: formatPaise(0),
      error: err.message,
    };
    agentRunHistory.push(errorResult);
    if (agentRunHistory.length > 10) agentRunHistory.shift();
    return errorResult;
  }
}

// ── Exported accessors ───────────────────────────────────────────────────────

export function getAgentRunHistory() {
  return [...agentRunHistory];
}

export function getActiveNotifications() {
  return [...activeNotifications];
}

export function getNotificationsByUser(userId) {
  return activeNotifications.filter(n => n.user_id === userId);
}

export function markNotificationRead(notificationId) {
  const notif = activeNotifications.find(n => n.notification_id === notificationId);
  if (!notif) return null;
  notif.read = true;
  return notif;
}

export function markNotificationActionTaken(notificationId) {
  const notif = activeNotifications.find(n => n.notification_id === notificationId);
  if (!notif) return null;
  notif.action_taken = true;
  return notif;
}
