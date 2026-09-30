import { handleError, method, roleIdFrom, send } from "./_lib/http.mjs";
import { getEmployee } from "./_lib/repository.mjs";
import { submitExpense, submitSale } from "./_lib/service.mjs";
import { RuleError } from "../business.mjs";
import { publicRecord } from "./_lib/public-data.mjs";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const employee = await getEmployee(roleIdFrom(req));
    if (!employee) throw new RuleError("Choose a valid demonstration role.", "FORBIDDEN", 403);
    const type = req.body?.type;
    const record = type === "sale"
      ? await submitSale(req.body, employee, "website")
      : type === "expense"
        ? await submitExpense(req.body, employee, "website")
        : null;
    if (!record) throw new RuleError("Transaction type must be sale or expense.");
    send(res, 201, { record: publicRecord(record), message: `${record.ref} was saved.`, syncStatus: record.sync_status });
  } catch (error) {
    handleError(res, error);
  }
}
