# Invoicer

Professional invoices for small businesses. Open the app, type your business name, and send your first invoice in a couple of minutes. There's no account to create and nothing to install, and your data never leaves your computer.

## What it does

- **Live preview.** The invoice appears on real-size paper beside the form and updates as you type.
- **Print or save as PDF.** Clean, print-ready layout with your logo, brand color, and payment details. The PDF is named after the invoice number and client.
- **Email, reminders and receipts.** A pre-written message matching the invoice's status (new invoice, friendly overdue reminder, or thank-you receipt) that you can open in your email app or copy.
- **Track who owes you.** A dashboard with outstanding, overdue, and recently paid totals. Overdue invoices are flagged automatically once the due date passes.
- **Clients remembered.** Type a new client's name once and they're saved. Next time, start typing and pick them from the list.
- **Correct money math.** Amounts are stored in whole cents, so line totals, discounts, and tax always add up. Quantities can be fractional (2.5 hours).
- **Sensible business rules.** Sequential invoice numbers (INV-0001, …) that warn on duplicates. Payment terms (Net 30, Due on receipt, …) set the due date. Sent invoices keep the business details they were sent with, and paid invoices are locked.
- **Any currency.** Twenty common currencies, formatted for your region, including zero-decimal currencies like JPY.
- **Backups and exports.** Download a backup file, restore it on another computer, or export every invoice as a CSV for your accountant.

## Getting started

Double-click `index.html`. It opens in your browser and works offline.

To run it on a local web server instead:

```sh
npm start        # serves this folder at http://localhost:4173
```

To put it online for yourself or your team, upload this folder to any static host: GitHub Pages, Netlify, Cloudflare Pages, or your own web space. No server code or database is needed.

## Using it

1. **Set up your business.** The first screen asks for your business name. Add your logo, address, tax number, brand color, and "how to pay" details under **Settings**. They appear on every invoice.
2. **Create an invoice.** Choose **New invoice**, enter the client, and add line items. Press Enter in a rate field to start the next line. Everything saves automatically.
3. **Send it.** Choose **Print / PDF**, then *Save as PDF*, and attach the file using **Email**. Mark the invoice as sent.
4. **Get paid.** When money arrives, choose **Record payment** and pick the date and method. The invoice is stamped PAID and you can send a receipt.

Other actions are under the **⋯** menu: duplicate an invoice for repeat work, move it back to drafts, void it (keeps a record without counting it as owed), or delete it.

## Your data

Invoicer stores everything in your browser's local storage on this device. Nothing is uploaded. This means:

- Your data stays with the browser and computer you use. To move it, go to **Settings → Download backup** and restore that file elsewhere.
- Clearing your browser's site data erases it. Download a backup now and then. Once you have a few sent invoices, the app reminds you monthly.
- Two tabs open at once stay in sync.

## Project layout

```
index.html          App shell
css/app.css         App interface (light and dark themes)
css/invoice.css     The invoice document and print rules
js/core.js          Money, dates, totals, numbering, CSV (pure functions)
js/html.js          Escaping HTML templates
js/document.js      Renders the invoice page and email text
js/store.js         Local storage, backups, sample data
js/app.js           Screens and interactions
tests/              Unit tests (Node's built-in test runner)
```

The app is plain HTML, CSS, and JavaScript with no build step and no dependencies. The scripts are classic `<script>` files rather than ES modules, so the app also works when opened straight from disk.

## Development

```sh
npm test
```

Runs the unit tests for the money math, dates, numbering, invoice rendering (including HTML escaping), email drafts, and storage (backups, corrupted data, full storage). Node 18 or newer is required.

## Possible next steps

- Cloud sync and sign-in, so invoices follow you across devices and teammates
- "Pay now" links through a payment provider such as Stripe
- Sending email directly with the PDF attached (needs a small server)
- Partial payments and deposits
- Recurring invoices and quotes/estimates that convert into invoices
