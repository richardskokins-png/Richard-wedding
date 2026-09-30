import { calculateCommission, calculateSummary } from "./business.mjs";

const submittedAt = "2026-09-28T09:00:00.000Z";

function approvedSale(ref, salespersonId, customer, project, description, amountCents, proposedShares, finalShares, origin = "website") {
  const commission = calculateCommission(amountCents, finalShares);
  return {
    ref, salesperson_id: salespersonId, customer, project, description, amount_cents: amountCents,
    proposed_shares: proposedShares, final_shares: finalShares,
    commission_pool_cents: commission.poolCents,
    commission_richard_cents: commission.earned.richard,
    commission_anastasia_cents: commission.earned.anastasia,
    commission_jean_claude_cents: commission.earned["jean-claude"],
    status: "approved", origin, submitted_at: submittedAt,
    sync_status: "synced", notification_status: "delivered"
  };
}

export const REFERENCE_SALES = Object.freeze([
  approvedSale("S01", "richard", "Olivia Rose", "A", "One proud uncle and an emotional grandmother", 100000, { richard: 50, anastasia: 30, "jean-claude": 20 }, { richard: 50, anastasia: 30, "jean-claude": 20 }, "telegram"),
  approvedSale("S02", "anastasia", "Daniel King", "B", "University friends, dancing, and the stripping performance", 200000, { richard: 0, anastasia: 50, "jean-claude": 50 }, { richard: 20, anastasia: 40, "jean-claude": 40 }),
  approvedSale("S03", "jean-claude", "Emma Stonebridge", "A", "Premium relatives, including an uncle presented as a surgeon", 150000, { richard: 40, anastasia: 40, "jean-claude": 20 }, { richard: 20, anastasia: 30, "jean-claude": 50 }),
  approvedSale("S04", "richard", "Lucas Green", "B", "Small group of loud university friends", 80000, { richard: 25, anastasia: 25, "jean-claude": 50 }, { richard: 25, anastasia: 25, "jean-claude": 50 }),
  {
    ref: "S05", salesperson_id: "richard", customer: "Mia Brooks", project: "B",
    description: "Extra guests and an embarrassing speech", amount_cents: 60000,
    proposed_shares: { richard: 100, anastasia: 0, "jean-claude": 0 }, final_shares: null,
    commission_pool_cents: 0, commission_richard_cents: 0, commission_anastasia_cents: 0,
    commission_jean_claude_cents: 0, status: "pending", origin: "website", submitted_at: submittedAt,
    sync_status: "synced", notification_status: "not_required"
  }
]);

export const REFERENCE_EXPENSES = Object.freeze([
  { ref: "E01", reporter_id: "kevin", description: "Rented suit and fake pearl necklace for the relatives", category: "Materials", amount_cents: 12000, proposed_allocation: "A", final_allocation: "A", status: "allocated", origin: "telegram", submitted_at: submittedAt, sync_status: "synced", notification_status: "delivered" },
  { ref: "E02", reporter_id: "kevin", description: "Taxi for the grandmother; Kevin selected the wrong project", category: "Travel", amount_cents: 8000, proposed_allocation: "B", final_allocation: "A", status: "allocated", origin: "website", submitted_at: submittedAt, sync_status: "synced", notification_status: "delivered" },
  { ref: "E03", reporter_id: "kevin", description: "Monthly company website subscription", category: "Other", amount_cents: 10000, proposed_allocation: "Company overhead", final_allocation: "Company overhead", status: "allocated", origin: "website", submitted_at: submittedAt, sync_status: "synced", notification_status: "not_required" },
  { ref: "E04", reporter_id: "kevin", description: "Replacement costumes after an enthusiastic dance performance", category: "Materials", amount_cents: 25000, proposed_allocation: "B", final_allocation: "B", status: "allocated", origin: "website", submitted_at: submittedAt, sync_status: "synced", notification_status: "delivered" },
  { ref: "E05", reporter_id: "kevin", description: "Minibus for university friends; Kevin selected the wrong project again", category: "Travel", amount_cents: 9000, proposed_allocation: "A", final_allocation: "B", status: "allocated", origin: "website", submitted_at: submittedAt, sync_status: "synced", notification_status: "delivered" },
  { ref: "E06", reporter_id: "kevin", description: "Company telephone subscription", category: "Other", amount_cents: 6000, proposed_allocation: "Company overhead", final_allocation: "Company overhead", status: "allocated", origin: "website", submitted_at: submittedAt, sync_status: "synced", notification_status: "not_required" },
  { ref: "E07", reporter_id: "kevin", description: "Emergency replacement clothing; project allocation still needs checking", category: "Materials", amount_cents: 14000, proposed_allocation: "A", final_allocation: null, status: "awaiting_allocation", origin: "website", submitted_at: submittedAt, sync_status: "synced", notification_status: "not_required" }
]);

export function referenceState() {
  const sales = structuredClone(REFERENCE_SALES);
  const expenses = structuredClone(REFERENCE_EXPENSES);
  for (const record of [...sales, ...expenses]) {
    record.sync_status = "reference";
    record.notification_status = "reference";
  }
  return { mode: "reference", sales, expenses, summary: calculateSummary(sales, expenses) };
}
