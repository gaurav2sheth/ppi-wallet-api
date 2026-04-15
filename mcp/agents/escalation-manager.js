/**
 * Escalation Manager — KYC Upgrade Escalation Tracking
 *
 * In-memory escalation store for tracking users who need
 * manual ops intervention for KYC upgrades.
 *
 * Usage:
 *   import { escalateToOps, getEscalations } from './escalation-manager.js';
 *   const esc = escalateToOps('user_001', context);
 */

// ── In-memory escalation store ───────────────────────────────────────────────
let activeEscalations = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatIST(date) {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

// ── Escalation CRUD ──────────────────────────────────────────────────────────

export function escalateToOps(userId, context) {
  const escalation = {
    escalation_id: `ESC-${Date.now()}-${userId}`,
    user_id: userId,
    name: context.name,
    phone: context.phone,
    priority: context.priority,
    days_until_expiry: context.days_until_expiry,
    total_at_risk: context.total_at_risk,
    escalation_reason: context.escalation_reason,
    outreach_attempts: context.outreach_attempts || 1,
    last_outreach_at: formatIST(new Date()),
    agent_reasoning: context.agent_reasoning,
    recommended_action: context.recommended_action || 'Manual outreach recommended',
    status: 'OPEN',
    created_at: formatIST(new Date()),
    assigned_to: null,
  };
  activeEscalations.push(escalation);
  return escalation;
}

export function getEscalations(filters = {}) {
  let result = [...activeEscalations];
  if (filters.status) result = result.filter(e => e.status === filters.status);
  if (filters.priority) result = result.filter(e => e.priority === filters.priority);
  return result.sort((a, b) => {
    const priorityOrder = { P1_CRITICAL: 0, P2_HIGH: 1, P3_MEDIUM: 2, P4_LOW: 3 };
    return (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4);
  });
}

export function resolveEscalation(escalationId, resolvedBy, notes) {
  const esc = activeEscalations.find(e => e.escalation_id === escalationId);
  if (!esc) return null;
  esc.status = 'RESOLVED';
  esc.resolved_by = resolvedBy;
  esc.resolution_notes = notes;
  esc.resolved_at = formatIST(new Date());
  return esc;
}

export function updateEscalationStatus(escalationId, status) {
  const esc = activeEscalations.find(e => e.escalation_id === escalationId);
  if (!esc) return null;
  esc.status = status;
  return esc;
}

export function getEscalationStats() {
  return {
    total: activeEscalations.length,
    open: activeEscalations.filter(e => e.status === 'OPEN').length,
    in_progress: activeEscalations.filter(e => e.status === 'IN_PROGRESS').length,
    resolved: activeEscalations.filter(e => e.status === 'RESOLVED').length,
    by_priority: {
      P1: activeEscalations.filter(e => e.priority === 'P1_CRITICAL').length,
      P2: activeEscalations.filter(e => e.priority === 'P2_HIGH').length,
      P3: activeEscalations.filter(e => e.priority === 'P3_MEDIUM').length,
      P4: activeEscalations.filter(e => e.priority === 'P4_LOW').length,
    },
  };
}
