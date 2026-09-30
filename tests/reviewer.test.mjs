import test from "node:test";
import assert from "node:assert/strict";
import { publicEmployee, publicRecord } from "../api/_lib/public-data.mjs";
import { createPairing, pairingHash, validPairingToken } from "../api/_lib/pairing.mjs";
import { referenceState } from "../fixtures.mjs";
import webhook from "../api/telegram-webhook.mjs";
import stateHandler from "../api/state.mjs";

function response() {
  return { statusCode: 0, headers: {}, body: null, status(n) { this.statusCode = n; }, setHeader(k,v) { this.headers[k] = v; }, json(body) { this.body = body; } };
}

test("public records and employees do not disclose Telegram identifiers or private errors", () => {
  assert.deepEqual(publicEmployee({id:"richard", name:"Richard",role:"salesperson",telegram_user_id:12345,telegram_chat_id:54321}), {id:"richard",name:"Richard",role:"salesperson"});
  assert.deepEqual(publicRecord({ref:"RV-1",amount_cents:100,origin_chat_id:54321,notification_error:"private details",sync_error:"credentials",future_private_field:"secret"}), {ref:"RV-1",amount_cents:100});
});

test("pairing links are unique, expire after ten minutes, and store only a hash", () => {
  const now = Date.now(); const one=createPairing(now); const two=createPairing(now);
  assert.ok(validPairingToken(one.token)); assert.notEqual(one.token,two.token);
  assert.equal(one.tokenHash,pairingHash(one.token)); assert.notEqual(one.tokenHash,one.token);
  assert.equal(Date.parse(one.expiresAt)-now,600000); assert.equal(validPairingToken("/bad-link"),false);
});

test("reference fixtures never claim actual Sheets or Telegram delivery", () => {
  const state=referenceState();
  for(const row of [...state.sales,...state.expenses]) {
    assert.equal(row.sync_status,"reference"); assert.equal(row.notification_status,"reference");
  }
  assert.equal(state.summary.company.resultCents,393000);
});

test("webhook rejects unconfigured and unauthenticated requests before using Telegram", async () => {
  const oldToken=process.env.TELEGRAM_BOT_TOKEN; const oldSecret=process.env.TELEGRAM_WEBHOOK_SECRET;
  try {
    delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const missing=response(); await webhook({method:"POST",headers:{},body:{}},missing); assert.equal(missing.statusCode,503);
    process.env.TELEGRAM_BOT_TOKEN="test-token"; process.env.TELEGRAM_WEBHOOK_SECRET="test-secret";
    const rejected=response(); await webhook({method:"POST",headers:{},body:{}},rejected); assert.equal(rejected.statusCode,403);
    const group=response(); await webhook({method:"POST",headers:{"x-telegram-bot-api-secret-token":"test-secret"},body:{message:{text:"/start",chat:{id:1,type:"group"},from:{id:1}}}},group); assert.equal(group.statusCode,200);
  } finally {
    if(oldToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=oldToken;
    if(oldSecret===undefined)delete process.env.TELEGRAM_WEBHOOK_SECRET;else process.env.TELEGRAM_WEBHOOK_SECRET=oldSecret;
  }
});

test("manager state response strips private Telegram data at the HTTP boundary", async () => {
  const oldFetch=globalThis.fetch; const oldUrl=process.env.SUPABASE_URL; const oldKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL="https://example.invalid";process.env.SUPABASE_SERVICE_ROLE_KEY="test";
  const fixture=referenceState();
  globalThis.fetch=async url=>new Response(JSON.stringify(String(url).includes('/employees?') ? [{id:"svetlana",name:"Svetlana",role:"manager",telegram_user_id:123456}] : String(url).includes('/sales?') ? fixture.sales.map(row=>({...row,origin_chat_id:987654})) : fixture.expenses.map(row=>({...row,origin_chat_id:987654}))),{status:200});
  try {
    const res=response(); await stateHandler({method:"GET",query:{role:"svetlana"}},res);
    assert.equal(res.statusCode,200); assert.equal(res.body.summary.company.resultCents,393000);
    assert.doesNotMatch(JSON.stringify(res.body),/telegram_user_id|origin_chat_id|123456|987654/);
  } finally {
    globalThis.fetch=oldFetch;
    if(oldUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=oldUrl;
    if(oldKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=oldKey;
  }
});
