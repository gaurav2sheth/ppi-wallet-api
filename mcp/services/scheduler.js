/**
 * KYC Alert Scheduler
 *
 * Runs the KYC Expiry Alert Service daily at 9:00 AM IST.
 * Uses node-cron for scheduling.
 *
 * Usage:
 *   import { startScheduler, stopScheduler } from './scheduler.js';
 *   startScheduler();  // starts the daily 9 AM IST job
 *   stopScheduler();   // stops the job
 *
 * Standalone:
 *   node services/scheduler.js
 */

import cron from 'node-cron';
import { runKycAlerts } from './kyc-alert-service.js';

let scheduledTask = null;

export function startScheduler() {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    console.error('[Scheduler] ANTHROPIC_API_KEY not set — scheduler will not start.');
    return;
  }

  // 9:00 AM IST = 3:30 AM UTC → cron: '30 3 * * *'
  scheduledTask = cron.schedule('30 3 * * *', async () => {
    const runId = new Date().toISOString();
    console.log(`\n[Scheduler] ⏰ Daily KYC Alert triggered at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} (run: ${runId})`);

    try {
      const result = await runKycAlerts(apiKey);
      console.log(`[Scheduler] ✅ Run complete — ${result.users_alerted} user(s) alerted, at-risk balance: ${result.total_at_risk_balance}`);
    } catch (err) {
      console.error(`[Scheduler] ❌ Run failed: ${err?.message || err}`);
    }
  }, {
    timezone: 'Asia/Kolkata',
  });

  console.log('[Scheduler] 📅 KYC Alert scheduler started — runs daily at 9:00 AM IST');
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log('[Scheduler] 🛑 KYC Alert scheduler stopped');
  }
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
