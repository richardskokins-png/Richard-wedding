import { RuleError } from "../../business.mjs";

export function send(res, status, payload) {
  res.status(status);
  res.setHeader("Cache-Control", "no-store");
  res.json(payload);
}

export function method(req, res, allowed) {
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed.join(", "));
    send(res, 405, { error: "Method not allowed.", code: "METHOD_NOT_ALLOWED" });
    return false;
  }
  return true;
}

export function roleIdFrom(req) {
  return String(req.body?.roleId || req.query?.role || req.headers?.["x-demo-role"] || "").trim();
}

export function handleError(res, error) {
  const status = error instanceof RuleError ? error.status : Number(error?.status || 500);
  const code = error instanceof RuleError ? error.code : error?.code || "SERVER_ERROR";
  const message = error instanceof RuleError || status < 500 ? error.message : "The request could not be completed.";
  if (status >= 500) console.error(error);
  send(res, status, { error: message, code });
}
