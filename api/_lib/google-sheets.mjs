import crypto from "node:crypto";
import { sheetsConfigured } from "./config.mjs";
import { SALESPEOPLE } from "../../business.mjs";

let tokenCache = { token: "", expiresAt: 0 };

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

async function accessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({
    iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const unsigned = `${header}.${payload}`;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey).toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || "Google authentication failed.");
  tokenCache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return tokenCache.token;
}

async function sheetsRequest(path, options = {}) {
  const token = await accessToken();
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || "Google Sheets update failed.");
  return data;
}

const SALES_HEADERS = ["Reference", "Submission time", "Salesperson", "Customer", "Project", "Description", "Amount EUR", "Proposed Richard %", "Proposed Anastasia %", "Proposed Jean-Claude %", "Approved Richard %", "Approved Anastasia %", "Approved Jean-Claude %", "Richard commission EUR", "Anastasia commission EUR", "Jean-Claude commission EUR", "Total commission EUR", "Status"];
const EXPENSE_HEADERS = ["Reference", "Submission time", "Reporter", "Description", "Category", "Amount EUR", "Proposed allocation", "Final allocation", "Status"];

function saleRow(sale) {
  const proposed = sale.proposed_shares || {};
  const approved = sale.final_shares || {};
  return [sale.ref, sale.submitted_at, sale.salesperson_id, sale.customer, sale.project, sale.description, sale.amount_cents / 100,
    proposed.richard ?? "", proposed.anastasia ?? "", proposed["jean-claude"] ?? "",
    approved.richard ?? "", approved.anastasia ?? "", approved["jean-claude"] ?? "",
    sale.commission_richard_cents / 100, sale.commission_anastasia_cents / 100, sale.commission_jean_claude_cents / 100,
    sale.commission_pool_cents / 100, sale.status];
}

function expenseRow(expense) {
  return [expense.ref, expense.submitted_at, expense.reporter_id, expense.description, expense.category, expense.amount_cents / 100,
    expense.proposed_allocation, expense.final_allocation || "", expense.status];
}

async function upsertRow(tab, headers, values) {
  const encodedHeaderRange = encodeURIComponent(`'${tab}'!A1:${String.fromCharCode(64 + headers.length)}1`);
  await sheetsRequest(`values/${encodedHeaderRange}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [headers] }) });
  const column = await sheetsRequest(`values/${encodeURIComponent(`'${tab}'!A:A`)}?majorDimension=COLUMNS`);
  const refs = column.values?.[0] || [];
  const rowIndex = refs.findIndex((value, index) => index > 0 && value === values[0]);
  if (rowIndex >= 1) {
    const row = rowIndex + 1;
    const endColumn = String.fromCharCode(64 + headers.length);
    return sheetsRequest(`values/${encodeURIComponent(`'${tab}'!A${row}:${endColumn}${row}`)}?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values: [values] }) });
  }
  return sheetsRequest(`values/${encodeURIComponent(`'${tab}'!A:${String.fromCharCode(64 + headers.length)}`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: [values] }) });
}

export async function syncRecord(type, record) {
  if (!sheetsConfigured()) throw new Error("Google Sheets is not configured.");
  if (type === "sale") return upsertRow("Sales", SALES_HEADERS, saleRow(record));
  return upsertRow("Expenses", EXPENSE_HEADERS, expenseRow(record));
}

export { SALESPEOPLE };
