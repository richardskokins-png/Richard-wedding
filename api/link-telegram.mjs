import { requireRole, RuleError } from "../business.mjs";
import { handleError, method, roleIdFrom, send } from "./_lib/http.mjs";
import { getEmployee, linkTelegram, listEmployees } from "./_lib/repository.mjs";

export default async function handler(req, res) {
  if (!method(req, res, ["GET", "POST"])) return;
  try {
    const manager = await getEmployee(roleIdFrom(req));
    requireRole(manager, ["manager"], "manage Telegram links");
    if (req.method === "GET") return send(res, 200, { employees: await listEmployees() });
    const employeeId = String(req.body?.employeeId || "");
    const telegramUserId = Number(req.body?.telegramUserId);
    const telegramChatId = Number(req.body?.telegramChatId);
    if (!employeeId || !Number.isSafeInteger(telegramUserId) || !Number.isSafeInteger(telegramChatId)) {
      throw new RuleError("Employee, Telegram user ID, and chat ID are required.");
    }
    const employee = await linkTelegram(employeeId, telegramUserId, telegramChatId);
    if (!employee) throw new RuleError("Employee not found.", "NOT_FOUND", 404);
    send(res, 200, { employee, message: `${employee.name} is linked to Telegram user ${telegramUserId}.` });
  } catch (error) {
    handleError(res, error);
  }
}
