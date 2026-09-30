# Friends Included finance system

A Vercel-ready implementation of the Day 4 “Wedding Guests for Hire” homework. The application uses one rules engine for website and Telegram transactions, persists records in Supabase, synchronizes readable rows to Google Sheets, and sends Telegram confirmations and manager-decision notifications.

## Public reviewer entry point

Submit **https://richard-wedding-six.vercel.app/test**. This stable production URL opens without a Vercel account. Do not submit a generated preview/deployment URL: Standard Protection can require Vercel team access on those URLs.

The self-contained Reviewer guide includes fictional sample entry buttons, manager approval steps, expected changes to totals, a browser-only reset with undo, and the future Telegram linking procedure. The linked Google Sheets ledger is shared as **Anyone with the link: Viewer**. Its Reference tabs contain fictional assignment examples; Sales and Expenses are reserved for future live synchronization.

Current scope: the public Reference-mode demo and Viewer ledger are available. Live database, Telegram and Sheets synchronization remain pending owner setup. Reference records explicitly say `reference`, never `delivered` or `synced`. Do not present them as evidence that the real bot was tested. Browser data stays in that browser and does not update the ledger.

This is a deliberately public fictional homework system. Anyone can choose the manager role. Never connect a production database or enter real customer data. Server credentials stay in Vercel; public responses and the Google ledger exclude real Telegram identifiers.

## What is included

- Five demonstration roles with server-side permission checks.
- Sale and expense validation, duplicate-reference protection, idempotent decisions, and exact commission rounding.
- Manager dashboard, original-vs-final proposals, pending queues, delivery status, and retries.
- Supabase SQL schema with the five fictional employees.
- Google Sheets upsert-by-reference for `Sales` and `Expenses` tabs.
- Telegram webhook commands, sender linking, submission confirmations, and decision notifications.
- The completed two-test reference scenario for local visual verification.
- Automated checks for the assignment totals and main rejection rules.

## Run the local reference preview

1. Install Node.js 20 or later.
2. Run `npm run dev`.
3. Open `http://127.0.0.1:4173`.

Reference mode is a local preview. It is deliberately labelled and does not claim to have sent real Telegram messages or Google Sheets updates.

## Important when uploading through GitHub

Upload **all files and folders** from the extracted project, including `api`, `shared`, `supabase`, and `tests`. The build verifies that every API endpoint and its imports exist, so an incomplete upload fails before it replaces a working deployment.

Vercel must use the **Other** framework preset, **npm run build** as the build command, and **public** as the output directory. These settings are declared in `vercel.json`. `app.mjs` runs in the browser and must never be selected as a Node server entrypoint: doing so causes `ReferenceError: document is not defined` and HTTP 500 on every page. The build copies only browser assets into `public`; Vercel deploys the `api` folder separately as server functions. Do not upload `.env.local`, credentials, `node_modules`, or `.git`.

Before deployment run `npm run check` and `npm run build`. After deployment, verify `/` displays the dashboard, `/app.mjs` is served as JavaScript, and `/api/config` returns JSON. If service credentials have not been configured, the page should open in clearly labelled Reference mode; Supabase, Sheets, and Telegram are not active until their setup below is completed.

## Connect the live services

1. Create a dedicated homework Supabase project, open its SQL editor, and run the full current `supabase/schema.sql`, including the pairing-token table and functions. It stores only fictional accounting data and private Telegram routing identifiers.
2. Use the linked fictional Google ledger. The empty `Sales` and `Expenses` tabs are ready for live data. Keep the fixed Reference tabs separate.
3. Enable the Google Sheets API, create a service account, and share the spreadsheet with its email as Editor.
4. Create a Telegram bot with BotFather and start a private chat with the bot.
5. Copy `.env.example` to `.env.local` for local tooling, and add the same values to Vercel project environment variables. Never commit the populated file.
6. Push this folder to a GitHub repository and import that repository into Vercel.
7. Set `APP_URL` to the stable public production origin, redeploy, then choose Svetlana → Manager setup → Activate webhook. The endpoint cannot redirect the bot or its webhook secret to a visitor-supplied URL. Both bot token and webhook secret are required before webhook messages are accepted.
8. Choose Svetlana → Manager setup → choose Richard or Kevin → Create my Telegram link. Open the personal link and press Start in a private Telegram chat. Links expire in ten minutes, are stored hashed, and are consumed atomically once. No reviewer shares their account IDs or a secret key.
9. Send `/whoami` to check the fictional role. Send `/unlink` when finished to erase the account link and stored notification destinations. Accounting records remain fictional and reviewable. Relinking a fictional employee never redirects older submissions to the next reviewer.

## Telegram formats

```text
/sale S01 | Olivia Rose | A | One proud uncle and an emotional grandmother | 1000 | 50/30/20
/expense E01 | Rented suit and fake pearl necklace for the relatives | Materials | 120 | A
```

The sender’s linked role supplies the salesperson or reporter identity. An unlinked Telegram user cannot submit.

## Official test order

Run Test 1 and Test 2 from the assignment in order. S01 and E01 must be submitted through the actual Telegram bot. Use the website demonstration roles for the other entries and Svetlana for decisions. Do not use the local reference records as proof of Telegram delivery.

Expected final control figures:

- Project A result: €2,050.00
- Project B result: €2,180.00
- Company result: €3,930.00
- Commission: Richard €140.00; Anastasia €175.00; Jean-Claude €215.00
- S05 stays pending; E07 stays awaiting allocation

## Final submission checklist

- Set `STUDENT_NAME`, `APP_URL`, `PUBLIC_GOOGLE_SHEETS_URL`, and `PUBLIC_GITHUB_URL` in Vercel.
- Give the instructor Viewer access to Google Sheets and access to the GitHub repository.
- Confirm the site says “Live services,” not “Reference mode.”
- Verify S01 and E01 preserve their original Telegram chat destination after relinking your Telegram ID.
- Test a Sheets failure and Telegram failure; retry without duplicate rows or changed totals.
- Put the single working Vercel URL in your own row of the course spreadsheet.
