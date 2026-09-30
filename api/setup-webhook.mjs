import { requireRole, RuleError } from "../business.mjs";
import { handleError, method, roleIdFrom, send } from "./_lib/http.mjs";
import { getEmployee } from "./_lib/repository.mjs";

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  try {
    const manager = await getEmployee(roleIdFrom(req));
    requireRole(manager, ["manager"], "configure the Telegram webhook");
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_WEBHOOK_SECRET) throw new RuleError("Telegram environment values are incomplete.", "SETUP_REQUIRED", 503);
    const appUrl = String(req.body?.appUrl || process.env.APP_URL || "").replace(/\/$/, "");
    if (!/^https:\/\//.test(appUrl)) throw new RuleError("Enter the public HTTPS Vercel URL.");
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `${appUrl}/api/telegram-webhook`, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ["message"] })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.description || "Telegram webhook setup failed.");
    send(res, 200, { message: "Telegram webhook is active.", webhook: `${appUrl}/api/telegram-webhook` });
  } catch (error) {
    handleError(res, error);
  }
}
