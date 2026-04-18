/**
 * Support Ticket Manager — Customer Support Ticket Tracking
 *
 * In-memory ticket store for tracking customer support issues,
 * SLA deadlines, and resolution workflows.
 *
 * Usage:
 *   import { createTicket, getUserTickets } from './support-ticket-manager.js';
 *   const ticket = createTicket('user_001', issueData);
 */

// ── In-memory ticket store ──────────────────────────────────────────────────
let tickets = [];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatIST(date = new Date()) {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function getSlaDeadline(priority) {
  const hours = { HIGH: 1, MEDIUM: 2, LOW: 4 };
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + (hours[priority] || 2));
  return formatIST(deadline);
}

// ── Ticket CRUD ─────────────────────────────────────────────────────────────

export function createTicket(userId, issueData) {
  const ticket = {
    ticket_id: `TKT-${Date.now()}-${userId}`,
    user_id: userId,
    name: issueData.name || userId,
    phone: issueData.phone || null,
    issue_type: issueData.issue_type,
    issue_summary: issueData.issue_summary || '',
    conversation_history: issueData.conversation_history || [],
    investigation_data: issueData.investigation_data || null,
    root_cause: issueData.root_cause || 'UNKNOWN',
    priority: issueData.priority || 'MEDIUM',
    status: 'OPEN',
    created_at: formatIST(new Date()),
    sla_resolve_by: getSlaDeadline(issueData.priority || 'MEDIUM'),
    resolved_at: null,
    resolved_by: null,
    resolution_notes: null,
    assigned_to: null,
  };
  tickets.push(ticket);
  return ticket;
}

export function getTicket(ticketId) {
  return tickets.find(t => t.ticket_id === ticketId) || null;
}

export function updateTicket(ticketId, updates) {
  const ticket = tickets.find(t => t.ticket_id === ticketId);
  if (!ticket) return null;
  Object.assign(ticket, updates);
  return ticket;
}

export function getUserTickets(userId) {
  return tickets.filter(t => t.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function getOpenTickets(priority) {
  let result = tickets.filter(t => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
  if (priority) result = result.filter(t => t.priority === priority);

  // Flag overdue tickets
  const now = new Date();
  result.forEach(t => {
    t.is_overdue = t.sla_resolve_by && new Date(t.sla_resolve_by) < now;
  });

  return result.sort((a, b) => {
    const po = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return (po[a.priority] ?? 3) - (po[b.priority] ?? 3);
  });
}

export function resolveTicket(ticketId, resolvedBy, resolutionNotes) {
  const ticket = tickets.find(t => t.ticket_id === ticketId);
  if (!ticket) return null;
  ticket.status = 'RESOLVED';
  ticket.resolved_at = formatIST(new Date());
  ticket.resolved_by = resolvedBy;
  ticket.resolution_notes = resolutionNotes;
  return ticket;
}

export function getTicketStats() {
  const now = new Date();
  const open = tickets.filter(t => t.status === 'OPEN');
  const overdue = open.filter(t => t.sla_resolve_by && new Date(t.sla_resolve_by) < now);

  return {
    total: tickets.length,
    open: open.length,
    in_progress: tickets.filter(t => t.status === 'IN_PROGRESS').length,
    resolved: tickets.filter(t => t.status === 'RESOLVED').length,
    overdue: overdue.length,
    by_priority: {
      HIGH: tickets.filter(t => t.priority === 'HIGH').length,
      MEDIUM: tickets.filter(t => t.priority === 'MEDIUM').length,
      LOW: tickets.filter(t => t.priority === 'LOW').length,
    },
    by_type: tickets.reduce((acc, t) => {
      acc[t.issue_type] = (acc[t.issue_type] || 0) + 1;
      return acc;
    }, {}),
  };
}
