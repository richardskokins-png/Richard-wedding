# Friends Included finance system

A Vercel-ready implementation of the Day 4 “Wedding Guests for Hire” homework. The application uses one rules engine for website and Telegram transactions, persists records in Supabase, synchronizes readable rows to Google Sheets, and sends Telegram confirmations and manager-decision notifications.

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

Upload **all files and folders** from the extracted project. The root files now include `business.mjs` and `fixtures.mjs`, so the visible reference application can build even when GitHub receives only the root files. However, the `api` folder is still required for Supabase, Telegram, and Google Sheets to work; `supabase` contains the database setup and `tests` contains the verification checks.

Before redeploying, confirm the GitHub repository shows `business.mjs`, `fixtures.mjs`, and the `api` folder alongside `app.mjs`.

## Connect the live services

1. Create a Supabase project, open its SQL editor, and run `supabase/schema.sql`.
2. Create a Google spreadsheet with tabs named `Sales` and `Expenses`.
3. Enable the Google Sheets API, create a service account, and share the spreadsheet with its email as Editor.
4. Create a Telegram bot with BotFather and start a private chat with the bot.
5. Copy `.env.example` to `.env.local` for local tooling, and add the same values to Vercel project environment variables. Never commit the populated file.
6. Push this folder to a GitHub repository and import that repository into Vercel.
7. After deployment, choose Svetlana → Manager setup → enter the public Vercel URL → Activate webhook.
8. In Telegram, send `/whoami`, then use Manager setup to link the returned user ID and chat ID to the fictional employee.

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
