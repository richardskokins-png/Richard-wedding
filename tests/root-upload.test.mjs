import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the browser entry resolves when only repository-root files are uploaded", () => {
  const entry = fs.readFileSync(path.join(projectRoot, "app.mjs"), "utf8");
  const imports = [...entry.matchAll(/\bfrom\s+["'](\.\/[^"']+)["']/g)].map((match) => match[1]);
  assert.deepEqual(imports.sort(), ["./business.mjs", "./fixtures.mjs"]);
  for (const specifier of imports) {
    const target = path.resolve(projectRoot, specifier);
    assert.equal(path.dirname(target), projectRoot, `${specifier} must stay in the repository root`);
    assert.ok(fs.existsSync(target), `${specifier} is missing from the repository root`);
  }
});
