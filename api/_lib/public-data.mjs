// Reviewers may choose any fictional role. Never expose their real Telegram
// identifiers, private delivery errors, or database metadata through that UI.
export function publicEmployee(employee) {
  if (!employee) return null;
  return { id: employee.id, name: employee.name, role: employee.role };
}

const recordFields = ["ref", "submitted_at", "salesperson_id", "reporter_id", "customer", "project", "description", "category", "amount_cents", "proposed_shares", "final_shares", "commission_pool_cents", "commission_richard_cents", "commission_anastasia_cents", "commission_jean_claude_cents", "proposed_allocation", "final_allocation", "status", "origin", "sync_status", "notification_status", "approved_at", "approved_by", "allocated_at", "allocated_by"];
export function publicRecord(record) {
  return Object.fromEntries(recordFields.filter(key => Object.hasOwn(record, key)).map(key => [key, record[key]]));
}
