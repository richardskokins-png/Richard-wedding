import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function moduleFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? moduleFiles(fullPath) : entry.name.endsWith(".mjs") ? [fullPath] : [];
  });
}

test("every local module import resolves inside the project", () => {
  for (const file of moduleFiles(projectRoot)) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /\bfrom\s+["']\//, `${path.relative(projectRoot, file)} contains a root-absolute module import`);
    const imports = [...source.matchAll(/(?:\bfrom\s*|\bimport\s*)["'](\.{1,2}\/[^"']+)["']/g)];
    for (const match of imports) {
      const target = path.resolve(path.dirname(file), match[1]);
      assert.ok(fs.existsSync(target), `${path.relative(projectRoot, file)} cannot resolve ${match[1]}`);
    }
  }
});
