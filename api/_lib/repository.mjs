import { requireCoreConfig } from "./config.mjs";
import { RuleError } from "../../business.mjs";

function headers(prefer) {
  const { supabaseKey } = requireCoreConfig();
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {})
  };
}

async function request(path, options = {}) {
  const { supabaseUrl } = requireCoreConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { ...headers(options.prefer), ...(options.headers || {}) }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    if (response.status === 409 || data?.code === "23505") {
      throw new RuleError("That reference already exists.", "DUPLICATE_REFERENCE", 409);
    }
    const error = new Error(data?.message || `Database request failed (${response.status}).`);
    error.status = response.status;
    error.code = data?.code || "DATABASE_ERROR";
    throw error;
  }
  return data;
}

export async function getEmployee(id) {
  if (!id) return null;
  const rows = await request(`employees?id=eq.${encodeURIComponent(id)}&select=*`);
  return rows[0] ?? null;
}

export async function getEmployeeByTelegramUser(userId) {
  const rows = await request(`employees?telegram_user_id=eq.${encodeURIComponent(userId)}&select=*`);
  return rows[0] ?? null;
}

export async function listEmployees() {
  return request("employees?select=*&order=role.asc,name.asc");
}

export async function savePairing(tokenHash, employeeId, expiresAt) {
  await request(`telegram_link_tokens?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, { method: "DELETE", prefer: "return=minimal" });
  return request("telegram_link_tokens", { method: "POST", body: JSON.stringify({ token_hash: tokenHash, employee_id: employeeId, expires_at: expiresAt }), prefer: "return=minimal" });
}

export async function consumePairing(tokenHash, userId, chatId) {
  const employeeId = await request("rpc/claim_telegram_link", { method: "POST", body: JSON.stringify({ p_token_hash: tokenHash, p_user_id: userId, p_chat_id: chatId }) });
  return employeeId ? getEmployee(employeeId) : null;
}

export async function unlinkTelegram(userId, chatId) {
  return request("rpc/unlink_telegram_account", { method: "POST", body: JSON.stringify({ p_user_id: userId, p_chat_id: chatId }) });
}

export async function linkTelegram(employeeId, userId, chatId) {
  await request(`employees?telegram_user_id=eq.${encodeURIComponent(userId)}&id=neq.${encodeURIComponent(employeeId)}`, {
    method: "PATCH",
    body: JSON.stringify({ telegram_user_id: null, telegram_chat_id: null }),
    prefer: "return=minimal"
  });
  const rows = await request(`employees?id=eq.${encodeURIComponent(employeeId)}`, {
    method: "PATCH",
    body: JSON.stringify({ telegram_user_id: userId, telegram_chat_id: chatId }),
    prefer: "return=representation"
  });
  return rows[0] ?? null;
}

export async function listSales(employee) {
  const filter = employee.role === "manager" ? "" : `&salesperson_id=eq.${encodeURIComponent(employee.id)}`;
  return request(`sales?select=*&order=submitted_at.desc${filter}`);
}

export async function listExpenses(employee) {
  const filter = employee.role === "manager" ? "" : `&reporter_id=eq.${encodeURIComponent(employee.id)}`;
  return request(`expenses?select=*&order=submitted_at.desc${filter}`);
}

export async function listAllRecords() {
  const [sales, expenses] = await Promise.all([
    request("sales?select=*&order=submitted_at.asc"),
    request("expenses?select=*&order=submitted_at.asc")
  ]);
  return { sales, expenses };
}

export async function getRecord(type, ref) {
  const table = type === "sale" ? "sales" : "expenses";
  const rows = await request(`${table}?ref=eq.${encodeURIComponent(ref)}&select=*`);
  return rows[0] ?? null;
}

export async function insertSale(sale) {
  const rows = await request("sales", {
    method: "POST",
    body: JSON.stringify(sale),
    prefer: "return=representation"
  });
  return rows[0];
}

export async function insertExpense(expense) {
  const rows = await request("expenses", {
    method: "POST",
    body: JSON.stringify(expense),
    prefer: "return=representation"
  });
  return rows[0];
}

export async function patchRecord(type, ref, values, extraFilter = "") {
  const table = type === "sale" ? "sales" : "expenses";
  const rows = await request(`${table}?ref=eq.${encodeURIComponent(ref)}${extraFilter}`, {
    method: "PATCH",
    body: JSON.stringify(values),
    prefer: "return=representation"
  });
  return rows[0] ?? null;
}

export async function updateDelivery(type, ref, values) {
  return patchRecord(type, ref, values);
}
