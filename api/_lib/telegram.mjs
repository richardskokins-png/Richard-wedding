import { telegramConfigured } from "./config.mjs";
import { centsToEuro, changedShares, SALESPEOPLE } from "../../business.mjs";

function money(cents) {
  return `€${centsToEuro(cents).toFixed(2)}`;
}

export async function sendTelegram(chatId, text) {
  if (!telegramConfigured()) throw new Error("Telegram is not configured.");
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || "Telegram delivery failed.");
  return data.result;
}

export function saleSubmissionText(sale) {
  return `Sale ${sale.ref} recorded. ${money(sale.amount_cents)} · Project ${sale.project} · Pending approval.`;
}

export function expenseSubmissionText(expense) {
  const allocation = expense.proposed_allocation;
  const status = expense.status === "allocated" ? "Allocated automatically" : "Awaiting allocation";
  return `Expense ${expense.ref} recorded. ${money(expense.amount_cents)} · ${allocation} · ${status}.`;
}

export function saleDecisionText(sale) {
  const changed = changedShares(sale.proposed_shares, sale.final_shares);
  const lines = [`Sale ${sale.ref} approved${changed ? " — commission split changed" : ""}.`, `Sale ${money(sale.amount_cents)}; total commission ${money(sale.commission_pool_cents)}.`];
  for (const person of SALESPEOPLE) {
    const label = person === "jean-claude" ? "Jean-Claude" : person[0].toUpperCase() + person.slice(1);
    const before = sale.proposed_shares[person];
    const after = sale.final_shares[person];
    const earned = sale[`commission_${person.replace("-", "_")}_cents`];
    lines.push(`${label}: ${before}%${before !== after ? ` → ${after}%` : ""} (${money(earned)}).`);
  }
  return lines.join("\n");
}

export function expenseDecisionText(expense) {
  const changed = expense.proposed_allocation !== expense.final_allocation;
  return `Expense ${expense.ref}${changed ? " — allocation changed" : " — allocation confirmed"}. ${money(expense.amount_cents)}: ${expense.description}. Proposed: ${expense.proposed_allocation}. Approved: ${expense.final_allocation}.`;
}
