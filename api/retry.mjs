import { normalizeRef, RuleError } from "../business.mjs";
import { handleError, method, roleIdFrom, send } from "./_lib/http.mjs";
import { getEmployee } from "./_lib/repository.mjs";
import { retryDelivery } from "./_lib/service.mjs";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const manager = await getEmployee(roleIdFrom(req));
    if (!manager) throw new RuleError("Choose a valid demonstration role.", "FORBIDDEN", 403);
    const record = await retryDelivery(req.body?.type, normalizeRef(req.body?.ref), req.body?.target, manager);
    send(res, 200, { record, message: `Retry completed for ${record.ref}.` });
  } catch (error) {
    handleError(res, error);
  }
}
