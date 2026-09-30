import { requireRole, RuleError } from "../business.mjs";
import { handleError, method, roleIdFrom, send } from "./_lib/http.mjs";
import { getEmployee, listEmployees, savePairing } from "./_lib/repository.mjs";
import { publicEmployee } from "./_lib/public-data.mjs";
import { createPairing } from "./_lib/pairing.mjs";
import { telegramConfigured } from "./_lib/config.mjs";

export default async function handler(req, res) {
  if (!method(req, res, ["GET", "POST"])) return;
  try {
    const manager = await getEmployee(roleIdFrom(req));
    requireRole(manager, ["manager"], "manage Telegram links");
    if (req.method === "GET") return send(res, 200, { employees: (await listEmployees()).map(publicEmployee) });
    if (!telegramConfigured()) throw new RuleError("The owner must connect the homework bot first.", "SETUP_REQUIRED", 503);
    if (req.body?.telegramUserId || req.body?.telegramChatId) throw new RuleError("Use the private Telegram pairing link. Account IDs are not accepted.");
    const employee = await getEmployee(String(req.body?.employeeId || ""));
    if (!employee || employee.role === "manager") throw new RuleError("Choose a fictional salesperson or Kevin.");
    const bot = process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
    if (!/^[A-Za-z0-9_]{5,32}$/.test(bot)) throw new RuleError("The bot username is not configured correctly.", "SETUP_REQUIRED", 503);
    const pairing = createPairing();
    await savePairing(pairing.tokenHash, employee.id, pairing.expiresAt);
    send(res, 200, { url: `https://t.me/${bot}?start=${pairing.token}`, expiresAt: pairing.expiresAt, message: `Open Telegram and press Start to link yourself as ${employee.name}. This link expires in 10 minutes and works once.` });
  } catch (error) {
    handleError(res, error);
  }
}
