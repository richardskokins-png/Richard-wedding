import { normalizeRef, RuleError } from "../business.mjs";
import { publicRecord } from "./_lib/public-data.mjs";
import { handleError, method, roleIdFrom, send } from "./_lib/http.mjs";
import { getEmployee } from "./_lib/repository.mjs";
import { allocateExpense, approveSale } from "./_lib/service.mjs";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const manager = await getEmployee(roleIdFrom(req));
    if (!manager) throw new RuleError("Choose a valid demonstration role.", "FORBIDDEN", 403);
    const ref = normalizeRef(req.body?.ref);
    const result = req.body?.type === "sale"
      ? await approveSale(ref, req.body?.finalShares, manager)
      : req.body?.type === "expense"
        ? await allocateExpense(ref, req.body?.finalAllocation, manager)
        : null;
    if (!result) throw new RuleError("Decision type must be sale or expense.");
    send(res, 200, { record: publicRecord(result.record), idempotent: result.idempotent, message: result.idempotent ? `${ref} was already decided; totals were unchanged.` : `${ref} was updated.` });
  } catch (error) {
    handleError(res, error);
  }
}
