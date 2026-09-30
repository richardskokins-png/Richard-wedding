import { RuleError } from "../business.mjs";
import { method, send } from "./_lib/http.mjs";
import { getEmployeeByTelegramUser, consumePairing, unlinkTelegram } from "./_lib/repository.mjs";
import { pairingHash, validPairingToken } from "./_lib/pairing.mjs";
import { submitExpense, submitSale } from "./_lib/service.mjs";
import { sendTelegram } from "./_lib/telegram.mjs";

const HELP = [
  "Friends Included finance bot",
  "",
  "Salespeople:",
  "/sale REF | Customer | A or B | Description | Amount | Richard/Anastasia/Jean-Claude %",
  "Example: /sale S01 | Olivia Rose | A | One proud uncle | 1000 | 50/30/20",
  "",
  "Kevin:",
  "/expense REF | Description | Materials, Travel, or Other | Amount | A, B, or Company overhead",
  "Example: /expense E01 | Rented suit | Materials | 120 | A",
  "",
  "Link your own account from the public website: choose Svetlana, Manager setup, then Create my Telegram link. Open the link and press Start.",
  "/whoami shows your fictional role. /unlink removes your Telegram link and saved notification destinations.",
  "Fictional homework data only. No real customer information or credentials."
].join("\n");

function parts(text) {
  return text.split("|").map((value) => value.trim());
}

function parseSale(text) {
  const values = parts(text.replace(/^\/sale(?:@\w+)?\s*/i, ""));
  if (values.length !== 6) throw new RuleError("Use: /sale REF | Customer | A or B | Description | Amount | 50/30/20");
  const shares = values[5].split("/").map((value) => Number(value.trim().replace("%", "")));
  if (shares.length !== 3) throw new RuleError("Enter three commission shares, for example 50/30/20.");
  return { ref: values[0], customer: values[1], project: values[2], description: values[3], amount: values[4], proposedShares: { richard: shares[0], anastasia: shares[1], "jean-claude": shares[2] } };
}

function parseExpense(text) {
  const values = parts(text.replace(/^\/expense(?:@\w+)?\s*/i, ""));
  if (values.length !== 5) throw new RuleError("Use: /expense REF | Description | Category | Amount | Allocation");
  return { ref: values[0], description: values[1], category: values[2], amount: values[3], proposedAllocation: values[4] };
}

export default async function handler(req, res) {
  if (!method(req, res, ["POST"])) return;
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || !process.env.TELEGRAM_BOT_TOKEN) return send(res, 503, { error: "The homework bot is not configured.", code: "SETUP_REQUIRED" });
  if (req.headers?.["x-telegram-bot-api-secret-token"] !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return send(res, 403, { error: "Invalid Telegram webhook secret." });
  }
  const message = req.body?.message;
  if (!message?.text || !message?.chat?.id || !message?.from?.id || message.chat.type !== "private") return send(res, 200, { ok: true });
  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text.trim();
  try {
    const startMatch = text.match(/^\/start(?:@\w+)?\s+(\S+)$/i);
    if (startMatch) {
      const token = startMatch[1];
      const employee = validPairingToken(token) ? await consumePairing(pairingHash(token), userId, chatId) : null;
      await sendTelegram(chatId, employee ? `Linked as ${employee.name}. Use fictional data only. Send /help for formats or /unlink when finished.` : "This link is invalid, expired, or already used. Create a new link from Manager setup.");
      return send(res, 200, { ok: true });
    }
    if (/^\/unlink(?:@\w+)?\b/i.test(text)) {
      await unlinkTelegram(userId, chatId);
      await sendTelegram(chatId, "Your Telegram link and saved notification destinations have been removed. Fictional accounting records remain available for review.");
      return send(res, 200, { ok: true });
    }
    if (/^\/(start|help)(?:@\w+)?\b/i.test(text)) {
      await sendTelegram(chatId, HELP);
      return send(res, 200, { ok: true });
    }
    if (/^\/whoami(?:@\w+)?\b/i.test(text)) {
      const employee = await getEmployeeByTelegramUser(userId);
      await sendTelegram(chatId, employee ? `Your fictional role: ${employee.name}.` : "You are not linked yet. Create your personal Telegram link in Manager setup on the homework website.");
      return send(res, 200, { ok: true });
    }
    const employee = await getEmployeeByTelegramUser(userId);
    if (!employee) {
      await sendTelegram(chatId, "You are not linked yet. Create your personal Telegram link in Manager setup on the homework website. No account IDs need to be shared.");
      return send(res, 200, { ok: true });
    }
    if (/^\/sale(?:@\w+)?\b/i.test(text)) await submitSale(parseSale(text), employee, "telegram", chatId);
    else if (/^\/expense(?:@\w+)?\b/i.test(text)) await submitExpense(parseExpense(text), employee, "telegram", chatId);
    else await sendTelegram(chatId, HELP);
  } catch (error) {
    try {
      await sendTelegram(chatId, error instanceof RuleError ? `Could not save the transaction: ${error.message}` : "The request could not be completed. The owner needs to check the service setup.");
    } catch {
      // Telegram will retry the webhook if we fail the request. The original
      // processing error is already represented by the absence of a new row.
    }
  }
  send(res, 200, { ok: true });
}
