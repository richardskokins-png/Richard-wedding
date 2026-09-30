import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateCommission,
  calculateSummary,
  employeeById,
  validateExpenseInput,
  validateSaleInput
} from "../business.mjs";
import { referenceState } from "../fixtures.mjs";

test("reference scenario matches the assignment totals", () => {
  const summary = referenceState().summary;
  assert.deepEqual(summary.projects.A, { incomeCents: 250000, commissionCents: 25000, expenseCents: 20000, resultCents: 205000 });
  assert.deepEqual(summary.projects.B, { incomeCents: 280000, commissionCents: 28000, expenseCents: 34000, resultCents: 218000 });
  assert.equal(summary.company.overheadCents, 16000);
  assert.equal(summary.company.awaitingAllocationCents, 14000);
  assert.equal(summary.company.resultCents, 393000);
  assert.deepEqual(summary.commissionByPerson, { richard: 14000, anastasia: 17500, "jean-claude": 21500 });
});

test("pending activity is excluded where required", () => {
  const { sales, expenses } = referenceState();
  const summary = calculateSummary(sales, expenses);
  assert.equal(summary.pendingSales, 1);
  assert.equal(summary.pendingExpenses, 1);
  assert.equal(summary.company.approvedIncomeCents, 530000);
  assert.equal(summary.company.recordedExpensesCents, 84000);
});

test("commission rounding gives the difference to the largest share", () => {
  const result = calculateCommission(1001, { richard: 50, anastasia: 30, "jean-claude": 20 });
  assert.equal(result.poolCents, 100);
  assert.equal(Object.values(result.earned).reduce((sum, value) => sum + value, 0), 100);
  assert.deepEqual(result.earned, { richard: 50, anastasia: 30, "jean-claude": 20 });
});

test("equal-largest rounding tie follows Richard, Anastasia, Jean-Claude", () => {
  const result = calculateCommission(50, { richard: 50, anastasia: 50, "jean-claude": 0 });
  assert.equal(result.poolCents, 5);
  assert.deepEqual(result.earned, { richard: 2, anastasia: 3, "jean-claude": 0 });
});

test("invalid commission split is refused", () => {
  assert.throws(() => validateSaleInput({ ref: "S99", customer: "Test", project: "A", description: "Test", amount: 100, proposedShares: { richard: 60, anastasia: 30, "jean-claude": 20 } }, employeeById("richard")), /must total 100/);
});

test("role enforcement refuses Kevin sale entry and salesperson expense entry", () => {
  assert.throws(() => validateSaleInput({ ref: "S99" }, employeeById("kevin")), /cannot submit sales/);
  assert.throws(() => validateExpenseInput({ ref: "E99" }, employeeById("richard")), /cannot submit expenses/);
});

test("missing and zero amounts are refused", () => {
  assert.throws(() => validateExpenseInput({ ref: "E99", description: "Test", category: "Other", amount: 0, proposedAllocation: "A" }, employeeById("kevin")), /greater than zero/);
});
