import { RuleError } from "../../business.mjs";
import { SUBMISSION } from "../../submission.mjs";

export function requireCoreConfig() {
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter((key) => !process.env[key]);
  if (missing.length) {
    throw new RuleError(`Server setup is incomplete: ${missing.join(", ")}.`, "SETUP_REQUIRED", 503);
  }
  return {
    supabaseUrl: process.env.SUPABASE_URL.replace(/\/$/, ""),
    supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
  };
}

export function sheetsConfigured() {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEETS_ID);
}

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET);
}

export function publicConfig() {
  return {
    backendConfigured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    sheetsConfigured: sheetsConfigured(),
    telegramConfigured: telegramConfigured(),
    telegramBotUsername: process.env.TELEGRAM_BOT_USERNAME || "",
    appUrl: process.env.APP_URL || SUBMISSION.appUrl,
    studentName: process.env.STUDENT_NAME || SUBMISSION.studentName,
    sheetsUrl: process.env.PUBLIC_GOOGLE_SHEETS_URL || SUBMISSION.sheetsUrl,
    githubUrl: process.env.PUBLIC_GITHUB_URL || SUBMISSION.githubUrl
  };
}
