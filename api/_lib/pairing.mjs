import { createHash, randomBytes } from "node:crypto";
export function pairingHash(token) {
  return createHash("sha256").update(token).digest("hex");
}
export function createPairing(now = Date.now()) {
  const token = randomBytes(24).toString("base64url");
  return { token, tokenHash: pairingHash(token), expiresAt: new Date(now + 10 * 60_000).toISOString() };
}
export function validPairingToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{32}$/.test(token);
}
