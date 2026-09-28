export const PEOPLE = Object.freeze([
  { id: "svetlana", name: "Svetlana de Monte Carlo", role: "manager" },
  { id: "richard", name: "Richard “Call Me Dick” Darling", role: "salesperson" },
  { id: "anastasia", name: "Anastasia Ferrari", role: "salesperson" },
  { id: "jean-claude", name: "Jean-Claude Bērziņš", role: "salesperson" },
  { id: "kevin", name: "Kevin von Whatever", role: "expense_reporter" }
]);

export const SALESPEOPLE = Object.freeze(["richard", "anastasia", "jean-claude"]);
export const PROJECTS = Object.freeze(["A", "B"]);
export const ALLOCATIONS = Object.freeze(["A", "B", "Company overhead"]);
export const CATEGORIES = Object.freeze(["Materials", "Travel", "Other"]);

export class RuleError extends Error {
  constructor(message, code = "INVALID_INPUT", status = 400) {
    super(message);
    this.name = "RuleError";
    this.code = code;
    this.status = status;
  }
}

export function employeeById(id) {
  return PEOPLE.find((person) => person.id === id) ?? null;
}

export function requireRole(employee, allowedRoles, action) {
  if (!employee || !allowedRoles.includes(employee.role)) {
    throw new RuleError(`This role cannot ${action}.`, "FORBIDDEN", 403);
  }
}

export function euroToCents(value) {
  const normalized = typeof value === "string" ? value.replace(",", ".").trim() : value;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new RuleError("Amount must be greater than zero.", "INVALID_AMOUNT");
  }
  return Math.round((amount + Number.EPSILON) * 100);
}

export function centsToEuro(cents) {
  return Number(cents || 0) / 100;
}

export function normalizeRef(value) {
  const ref = String(value || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9-]{1,19}$/.test(ref)) {
    throw new RuleError("Reference must start with a letter and contain 2–20 letters, numbers, or hyphens.", "INVALID_REFERENCE");
  }
  return ref;
}

export function validateShares(shares) {
  const normalized = {};
  for (const person of SALESPEOPLE) {
    const value = Number(shares?.[person]);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new RuleError("Each commission share must be between 0% and 100%.", "INVALID_SPLIT");
    }
    normalized[person] = value;
  }
  const total = SALESPEOPLE.reduce((sum, person) => sum + normalized[person], 0);
  if (Math.abs(total - 100) > 0.000001) {
    throw new RuleError(`Commission shares total ${total}%. They must total 100%.`, "INVALID_SPLIT");
  }
  return normalized;
}

export function calculateCommission(amountCents, shares) {
  const finalShares = validateShares(shares);
  const poolCents = Math.round(amountCents * 0.1);
  const earned = {};
  let distributed = 0;
  for (const person of SALESPEOPLE) {
    earned[person] = Math.round(poolCents * finalShares[person] / 100);
    distributed += earned[person];
  }
  const difference = poolCents - distributed;
  if (difference !== 0) {
    const winner = [...SALESPEOPLE].sort((a, b) => finalShares[b] - finalShares[a])[0];
    earned[winner] += difference;
  }
  return { poolCents, earned, shares: finalShares };
}

export function validateSaleInput(input, employee) {
  requireRole(employee, ["salesperson"], "submit sales");
  const customer = String(input.customer || "").trim();
  const description = String(input.description || "").trim();
  const project = String(input.project || "").trim().toUpperCase();
  if (!customer || !description) throw new RuleError("Customer and description are required.");
  if (!PROJECTS.includes(project)) throw new RuleError("Project must be A or B.", "INVALID_PROJECT");
  return {
    ref: normalizeRef(input.ref),
    salespersonId: employee.id,
    customer,
    project,
    description,
    amountCents: euroToCents(input.amount),
    proposedShares: validateShares(input.proposedShares)
  };
}

export function validateExpenseInput(input, employee) {
  requireRole(employee, ["expense_reporter"], "submit expenses");
  const description = String(input.description || "").trim();
  const category = String(input.category || "").trim();
  const proposedAllocation = String(input.proposedAllocation || "").trim();
  if (!description) throw new RuleError("Description is required.");
  if (!CATEGORIES.includes(category)) throw new RuleError("Choose Materials, Travel, or Other.", "INVALID_CATEGORY");
  if (!ALLOCATIONS.includes(proposedAllocation)) throw new RuleError("Choose project A, project B, or Company overhead.", "INVALID_ALLOCATION");
  return {
    ref: normalizeRef(input.ref),
    reporterId: employee.id,
    description,
    category,
    amountCents: euroToCents(input.amount),
    proposedAllocation,
    finalAllocation: proposedAllocation === "Company overhead" ? "Company overhead" : null,
    status: proposedAllocation === "Company overhead" ? "allocated" : "awaiting_allocation"
  };
}

export function calculateSummary(sales = [], expenses = []) {
  const approvedSales = sales.filter((sale) => sale.status === "approved");
  const allocatedExpenses = expenses.filter((expense) => expense.status === "allocated");
  const pendingExpenses = expenses.filter((expense) => expense.status === "awaiting_allocation");

  const projects = Object.fromEntries(PROJECTS.map((project) => [project, {
    incomeCents: 0,
    commissionCents: 0,
    expenseCents: 0,
    resultCents: 0
  }]));
  const commissionByPerson = Object.fromEntries(SALESPEOPLE.map((person) => [person, 0]));

  for (const sale of approvedSales) {
    projects[sale.project].incomeCents += sale.amount_cents ?? sale.amountCents ?? 0;
    projects[sale.project].commissionCents += sale.commission_pool_cents ?? sale.commissionPoolCents ?? 0;
    for (const person of SALESPEOPLE) {
      commissionByPerson[person] += sale[`commission_${person.replace("-", "_")}_cents`] ?? sale.commissionEarned?.[person] ?? 0;
    }
  }
  for (const expense of allocatedExpenses) {
    const allocation = expense.final_allocation ?? expense.finalAllocation;
    if (PROJECTS.includes(allocation)) {
      projects[allocation].expenseCents += expense.amount_cents ?? expense.amountCents ?? 0;
    }
  }
  for (const project of PROJECTS) {
    projects[project].resultCents = projects[project].incomeCents - projects[project].commissionCents - projects[project].expenseCents;
  }

  const approvedIncomeCents = approvedSales.reduce((sum, sale) => sum + (sale.amount_cents ?? sale.amountCents ?? 0), 0);
  const commissionCents = approvedSales.reduce((sum, sale) => sum + (sale.commission_pool_cents ?? sale.commissionPoolCents ?? 0), 0);
  const recordedExpensesCents = expenses.reduce((sum, expense) => sum + (expense.amount_cents ?? expense.amountCents ?? 0), 0);
  const overheadCents = allocatedExpenses
    .filter((expense) => (expense.final_allocation ?? expense.finalAllocation) === "Company overhead")
    .reduce((sum, expense) => sum + (expense.amount_cents ?? expense.amountCents ?? 0), 0);
  const awaitingAllocationCents = pendingExpenses.reduce((sum, expense) => sum + (expense.amount_cents ?? expense.amountCents ?? 0), 0);

  return {
    projects,
    company: {
      approvedIncomeCents,
      commissionCents,
      recordedExpensesCents,
      overheadCents,
      awaitingAllocationCents,
      resultCents: approvedIncomeCents - commissionCents - recordedExpensesCents
    },
    commissionByPerson,
    pendingSales: sales.filter((sale) => sale.status === "pending").length,
    pendingExpenses: pendingExpenses.length
  };
}

export function changedShares(proposed, finalShares) {
  return SALESPEOPLE.some((person) => Number(proposed?.[person]) !== Number(finalShares?.[person]));
}
