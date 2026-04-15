/**
 * PPI Wallet Scheduler
 *
 * Manages three independent cron jobs:
 * 1. KYC Alert Service — daily at 9:00 AM IST (3:30 AM UTC)
 * 2. KYC Upgrade Agent — daily at 8:00 AM IST (2:30 AM UTC)
 * 3. Follow-up Checker — every 6 hours
 *
 * Usage:
 *   import { startScheduler, stopScheduler, getSchedulerStatus } from './scheduler.js';
 *   startScheduler();          // starts all jobs
 *   stopScheduler();           // stops all jobs
 *   getSchedulerStatus();      // returns info about all jobs
 *
 *   // Individual control:
 *   startKycAlertJob();  stopKycAlertJob();
 *   startKycUpgradeAgentJob();  stopKycUpgradeAgentJob();
 *   startFollowUpCheckerJob();  stopFollowUpCheckerJob();
 *
 * Standalone:
 *   node services/scheduler.js
 */

import cron from 'node-cron';
import { runKycAlerts } from './kyc-alert-service.js';
import {
  runKycUpgradeAgent,
  observeUserResponse,
  handleFollowUpOrEscalation,
  getActiveNotifications,
} from '../agents/kyc-upgrade-agent.js';

// ── Job state ────────────────────────────────────────────────────────────────

let kycAlertTask = null;
let kycUpgradeAgentTask = null;
let followUpCheckerTask = null;

// ── 1. KYC Alert Job — Daily 9:00 AM IST (cron: '30 3 * * *') ──────────────

export function startKycAlertJob() {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    console.error('[Scheduler] ANTHROPIC_API_KEY not set — KYC Alert job will not start.');
    return;
  }

  kycAlertTask = cron.schedule('30 3 * * *', async () => {
    const runId = new Date().toISOString();
    console.log(`\n[Scheduler] ⏰ Daily KYC Alert triggered at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (run: ${runId})`);

    try {
      const result = await runKycAlerts(apiKey);
      console.log(`[Scheduler] ✅ Run complete — ${result.users_alerted} user(s) alerted, at-risk balance: ${result.total_at_risk_balance}`);
    } catch (err) {
      console.error(`[Scheduler] ❌ KYC Alert run failed: ${err?.message || err}`);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  console.log('[Scheduler] 📅 KYC Alert job started — runs daily at 9:00 AM IST');
}

export function stopKycAlertJob() {
  if (kycAlertTask) {
    kycAlertTask.stop();
    kycAlertTask = null;
    console.log('[Scheduler] 🛑 KYC Alert job stopped');
  }
}

// ── 2. KYC Upgrade Agent — Daily 8:00 AM IST (cron: '30 2 * * *') ──────────

export function startKycUpgradeAgentJob() {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    console.error('[Scheduler] ANTHROPIC_API_KEY not set — KYC Upgrade Agent job will not start.');
    return;
  }

  kycUpgradeAgentTask = cron.schedule('30 2 * * *', async () => {
    console.log(`\n[Scheduler] 🤖 KYC Upgrade Agent — Daily run started`);

    try {
      const result = await runKycUpgradeAgent(apiKey);
      const usersProcessed = result.summary?.users_scanned ?? result.users_processed ?? 0;
      console.log(`[Scheduler] 🤖 KYC Upgrade Agent — Run complete: ${usersProcessed} users processed`);
    } catch (err) {
      console.error(`[Scheduler] ❌ KYC Upgrade Agent run failed: ${err?.message || err}`);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  console.log('[Scheduler] 📅 KYC Upgrade Agent job started — runs daily at 8:00 AM IST');
}

export function stopKycUpgradeAgentJob() {
  if (kycUpgradeAgentTask) {
    kycUpgradeAgentTask.stop();
    kycUpgradeAgentTask = null;
    console.log('[Scheduler] 🛑 KYC Upgrade Agent job stopped');
  }
}

// ── 3. Follow-up Checker — Every 6 hours (cron: '0 */6 * * *') ─────────────

export function startFollowUpCheckerJob() {
  followUpCheckerTask = cron.schedule('0 */6 * * *', async () => {
    try {
      const activeNotifications = getActiveNotifications();
      const count = activeNotifications.length;

      for (const notification of activeNotifications) {
        const userResponse = observeUserResponse(notification.user_id, 'follow_up_check');
        handleFollowUpOrEscalation(notification.user_id, 'follow_up', {
          notification_id: notification.notification_id,
          response: userResponse,
        });
      }

      console.log(`[Scheduler] 🔍 Follow-up checker — Checked ${count} pending cases`);
    } catch (err) {
      console.error(`[Scheduler] ❌ Follow-up checker failed: ${err?.message || err}`);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  console.log('[Scheduler] 📅 Follow-up Checker job started — runs every 6 hours');
}

export function stopFollowUpCheckerJob() {
  if (followUpCheckerTask) {
    followUpCheckerTask.stop();
    followUpCheckerTask = null;
    console.log('[Scheduler] 🛑 Follow-up Checker job stopped');
  }
}

// ── Aggregate start/stop ────────────────────────────────────────────────────

export function startScheduler() {
  startKycAlertJob();
  startKycUpgradeAgentJob();
  startFollowUpCheckerJob();
}

export function stopScheduler() {
  stopKycAlertJob();
  stopKycUpgradeAgentJob();
  stopFollowUpCheckerJob();
}

// ── Scheduler status ────────────────────────────────────────────────────────

export function getSchedulerStatus() {
  return {
    jobs: [
      {
        name: 'KYC Alert Service',
        cron: '30 3 * * *',
        schedule: 'Daily at 9:00 AM IST',
        enabled: kycAlertTask !== null,
      },
      {
        name: 'KYC Upgrade Agent',
        cron: '30 2 * * *',
        schedule: 'Daily at 8:00 AM IST',
        enabled: kycUpgradeAgentTask !== null,
      },
      {
        name: 'Follow-up Checker',
        cron: '0 */6 * * *',
        schedule: 'Every 6 hours',
        enabled: followUpCheckerTask !== null,
      },
    ],
  };
}

// ── Standalone execution ─────────────────────────────────────────────────────
// Run directly: node services/scheduler.js
if (process.argv[1]?.endsWith('scheduler.js')) {
  console.log('[Scheduler] Starting in standalone mode...');
  startScheduler();

  // Also run once immediately for testing
  if (process.argv.includes('--run-now')) {
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    console.log('[Scheduler] --run-now flag detected, running immediately...\n');
    runKycAlerts(apiKey)
      .then(r => {
        console.log(`\n[Scheduler] Immediate run complete — ${r.users_alerted} alerts sent.`);
      })
      .catch(err => {
        console.error(`[Scheduler] Immediate run failed: ${err?.message || err}`);
        process.exit(1);
      });
  }
}
