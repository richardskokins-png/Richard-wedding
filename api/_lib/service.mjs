import {
  ALLOCATIONS,
  RuleError,
  calculateCommission,
  employeeById,
  requireRole,
  validateExpenseInput,
  validateSaleInput,
  validateShares
} from "../../business.mjs";
import {
  getEmployee,
  getRecord,
  insertExpense,
  insertSale,
  patchRecord,
  updateDelivery
} from "./repository.mjs";
import { syncRecord } from "./google-sheets.mjs";
import {
  expenseDecisionText,
  expenseSubmissionText,
  saleDecisionText,
  saleSubmissionText,
  sendTelegram
} from "./telegram.mjs";

async function syncAndMark(type, record) {
  try {
    await syncRecord(type, record);
    return await updateDelivery(type, record.ref, { sync_status: "synced", sync_error: null });
  } catch (error) {
    await updateDelivery(type, record.ref, { sync_status: "failed", sync_error: error.message });
    return { ...record, sync_status: "failed", sync_error: error.message };
  }
}

async function notifyAndMark(type, record, chatId, text) {
  if (!chatId) return updateDelivery(type, record.ref, { notification_status: "no_recipient", notification_error: "No Telegram recipient linked" });
  try {
    await sendTelegram(chatId, text);
    return updateDelivery(type, record.ref, { notification_status: "delivered", notification_error: null });
  } catch (error) {
    return updateDelivery(type, record.ref, { notification_status: "failed", notification_error: error.message });
  }
}

export async function submitSale(input, employee, origin = "website", originChatId = null) {
  const sale = validateSaleInput(input, employee);
  let record = await insertSale({
    ref: sale.ref,
    salesperson_id: sale.salespersonId,
    customer: sale.customer,
    project: sale.project,
    description: sale.description,
    amount_cents: sale.amountCents,
    proposed_shares: sale.proposedShares,
    status: "pending",
    origin,
    origin_chat_id: originChatId,
    sync_status: "pending",
    notification_status: origin === "telegram" ? "pending" : "not_required"
  });
  record = await syncAndMark("sale", record);
  if (origin === "telegram") record = await notifyAndMark("sale", record, originChatId, saleSubmissionText(record));
  return record;
}

export async function submitExpense(input, employee, origin = "website", originChatId = null) {
  const expense = validateExpenseInput(input, employee);
  let record = await insertExpense({
    ref: expense.ref,
    reporter_id: expense.reporterId,
    description: expense.description,
    category: expense.category,
    amount_cents: expense.amountCents,
    proposed_allocation: expense.proposedAllocation,
    final_allocation: expense.finalAllocation,
    status: expense.status,
    origin,
    origin_chat_id: originChatId,
    sync_status: "pending",
    notification_status: origin === "telegram" ? "pending" : "not_required"
  });
  record = await syncAndMark("expense", record);
  if (origin === "telegram") record = await notifyAndMark("expense", record, originChatId, expenseSubmissionText(record));
  return record;
}

async function decisionRecipient(record, employeeId) {
  if (record.origin_chat_id) return record.origin_chat_id;
  const employee = await getEmployee(employeeId);
  return employee?.telegram_chat_id || null;
}

export async function approveSale(ref, finalSharesInput, manager) {
  requireRole(manager, ["manager"], "approve sales");
  const existing = await getRecord("sale", ref);
  if (!existing) throw new RuleError("Sale not found.", "NOT_FOUND", 404);
  if (existing.status === "approved") return { record: existing, idempotent: true };
  const finalShares = validateShares(finalSharesInput || existing.proposed_shares);
  const commission = calculateCommission(existing.amount_cents, finalShares);
  let record = await patchRecord("sale", existing.ref, {
    final_shares: finalShares,
    commission_pool_cents: commission.poolCents,
    commission_richard_cents: commission.earned.richard,
    commission_anastasia_cents: commission.earned.anastasia,
    commission_jean_claude_cents: commission.earned["jean-claude"],
    status: "approved",
    approved_at: new Date().toISOString(),
    approved_by: manager.id,
    notification_status: "pending"
  }, "&status=eq.pending");
  if (!record) return { record: await getRecord("sale", ref), idempotent: true };
  record = await syncAndMark("sale", record);
  const chatId = await decisionRecipient(record, record.salesperson_id);
  record = await notifyAndMark("sale", record, chatId, saleDecisionText(record));
  return { record, idempotent: false };
}

export async function allocateExpense(ref, finalAllocation, manager) {
  requireRole(manager, ["manager"], "allocate expenses");
  if (!ALLOCATIONS.includes(finalAllocation)) throw new RuleError("Choose project A, project B, or Company overhead.", "INVALID_ALLOCATION");
  const existing = await getRecord("expense", ref);
  if (!existing) throw new RuleError("Expense not found.", "NOT_FOUND", 404);
  if (existing.status === "allocated") return { record: existing, idempotent: true };
  let record = await patchRecord("expense", existing.ref, {
    final_allocation: finalAllocation,
    status: "allocated",
    allocated_at: new Date().toISOString(),
    allocated_by: manager.id,
    notification_status: "pending"
  }, "&status=eq.awaiting_allocation");
  if (!record) return { record: await getRecord("expense", ref), idempotent: true };
  record = await syncAndMark("expense", record);
  const chatId = await decisionRecipient(record, record.reporter_id);
  record = await notifyAndMark("expense", record, chatId, expenseDecisionText(record));
  return { record, idempotent: false };
}

export async function retryDelivery(type, ref, target, manager) {
  requireRole(manager, ["manager"], "retry integrations");
  if (!["sale", "expense"].includes(type)) throw new RuleError("Unknown record type.");
  const record = await getRecord(type, ref);
  if (!record) throw new RuleError("Record not found.", "NOT_FOUND", 404);
  if (target === "sheets") return syncAndMark(type, record);
  if (target !== "telegram") throw new RuleError("Retry target must be sheets or telegram.");
  const employeeId = type === "sale" ? record.salesperson_id : record.reporter_id;
  const chatId = await decisionRecipient(record, employeeId);
  const text = type === "sale" ? (record.status === "approved" ? saleDecisionText(record) : saleSubmissionText(record)) : (record.status === "allocated" && record.final_allocation !== "Company overhead" ? expenseDecisionText(record) : expenseSubmissionText(record));
  return notifyAndMark(type, record, chatId, text);
}

export function fallbackEmployee(id) {
  return employeeById(id);
}
