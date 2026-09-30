import fs from "node:fs/promises";

const root = new URL("./", import.meta.url);
const browserFiles = ["index.html", "styles.css", "app.mjs", "business.mjs", "fixtures.mjs", "submission.mjs"];
const endpoints = ["config", "state", "transaction", "decision", "retry", "link-telegram", "setup-webhook", "telegram-webhook"];

// Fail the build for incomplete uploads instead of publishing broken API routes.
for (const name of [...browserFiles, ...endpoints.map((name) => `api/${name}.mjs`)]) {
  await fs.access(new URL(name, root));
}
for (const name of endpoints) await import(new URL(`api/${name}.mjs`, root));

const output = new URL("public/", root);
await fs.mkdir(output, { recursive: true });
for (const name of browserFiles) {
  await fs.copyFile(new URL(name, root), new URL(name, output));
}
console.log(`Built ${browserFiles.length} browser assets; verified ${endpoints.length} API endpoints.`);
