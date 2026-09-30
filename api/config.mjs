import { publicConfig } from "./_lib/config.mjs";
import { method, send } from "./_lib/http.mjs";

export default async function handler(req, res) {
  if (!method(req, res, ["GET"])) return;
  send(res, 200, publicConfig());
}
