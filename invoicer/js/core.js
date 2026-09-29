/*
 * Invoicer core: money, dates, totals and numbering.
 * Pure functions only (no DOM), shared by the app and the Node test suite.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InvoiceCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Money
  // Amounts are stored as integers in the currency's minor unit (cents for USD,
  // whole yen for JPY), so totals never pick up floating-point drift.
  // ---------------------------------------------------------------------------

  const decimalsCache = new Map();

  function currencyDecimals(currency) {
    if (!decimalsCache.has(currency)) {
      let digits = 2;
      try {
        digits = new Intl.NumberFormat('en', { style: 'currency', currency })
          .resolvedOptions().maximumFractionDigits;
      } catch (e) {
        // Unknown currency code: assume two decimal places.
      }
      decimalsCache.set(currency, digits);
    }
    return decimalsCache.get(currency);
  }

  // Round half away from zero, after trimming float noise
  // (1.005 * 100 is 100.49999999999999 in binary floating point).
  function roundHalfAway(x) {
    const trimmed = Math.round(Math.abs(x) * 1e6) / 1e6;
    return Math.sign(x) * Math.round(trimmed) || 0;
  }

  function toMinor(major, currency) {
    return roundHalfAway((Number(major) || 0) * 10 ** currencyDecimals(currency));
  }

  function fromMinor(minor, currency) {
    return (Number(minor) || 0) / 10 ** currencyDecimals(currency);
  }

  // Keep the same face value when an invoice switches currency
  // (12.50 USD becomes 12.50 EUR). No exchange rate is applied.
  function rescaleAmount(minor, fromCurrency, toCurrency) {
    const shift = currencyDecimals(toCurrency) - currencyDecimals(fromCurrency);
    return roundHalfAway((Number(minor) || 0) * 10 ** shift);
  }

  const moneyFormatters = new Map();

  function formatMoney(minor, currency, locale) {
    const key = `${locale}|${currency}`;
    let fmt = moneyFormatters.get(key);
    if (!fmt) {
      try {
        fmt = new Intl.NumberFormat(locale, { style: 'currency', currency });
      } catch (e) {
        try {
          fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency });
        } catch (e2) {
          fmt = { format: (n) => `${currency} ${n.toFixed(2)}` };
        }
      }
      moneyFormatters.set(key, fmt);
    }
    return fmt.format(fromMinor(minor, currency));
  }

  // Plain number for an editable field: "1234.5" -> "1234.50" (no grouping).
  function formatDecimal(value, locale, { min = 0, max = 4 } = {}) {
    return new Intl.NumberFormat(locale, {
      useGrouping: false,
      minimumFractionDigits: min,
      maximumFractionDigits: Math.max(min, max),
    }).format(Number(value) || 0);
  }

  function decimalSeparator(locale) {
    try {
      const part = new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal');
      return part ? part.value : '.';
    } catch (e) {
      return '.';
    }
  }

  // Read what a person typed into an amount field: "$1,234.50", "1.234,50", "(20)".
  function parseDecimal(input, decimalSep = '.') {
    if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
    const text = String(input == null ? '' : input).trim();
    if (!text) return 0;
    const negative = /^\(.*\)$/.test(text) || /[-−]/.test(text);
    let s = text.replace(/[^\d.,]/g, '');
    s = decimalSep === ',' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return 0;
    return negative ? -n : n;
  }

  // ---------------------------------------------------------------------------
  // Totals
  // ---------------------------------------------------------------------------

  function lineAmount(item) {
    return roundHalfAway((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0));
  }

  function calcTotals(inv) {
    const items = inv.items || [];
    const subtotal = items.reduce((sum, item) => sum + lineAmount(item), 0);
    const base = Math.max(0, subtotal);
    const discountValue = Math.max(0, Number(inv.discountValue) || 0);
    const discount = inv.discountType === 'amount'
      ? Math.min(Math.round(discountValue), base)
      : roundHalfAway((base * Math.min(discountValue, 100)) / 100);
    const taxable = subtotal - discount;
    const tax = roundHalfAway((taxable * Math.max(0, Number(inv.taxRate) || 0)) / 100);
    const total = taxable + tax;
    const amountPaid = inv.status === 'paid' ? total : 0;
    const balanceDue = inv.status === 'void' ? 0 : total - amountPaid;
    return { subtotal, discount, taxable, tax, total, amountPaid, balanceDue };
  }

  // ---------------------------------------------------------------------------
  // Dates (ISO "YYYY-MM-DD" strings, calculated in UTC so time zones never shift a day)
  // ---------------------------------------------------------------------------

  const DAY_MS = 86400000;
  const pad2 = (n) => String(n).padStart(2, '0');

  function todayISO(now = new Date()) {
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  function isISODate(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  const isoToUTC = (iso) => Date.parse(`${iso}T00:00:00Z`);

  function addDays(iso, days) {
    return new Date(isoToUTC(iso) + days * DAY_MS).toISOString().slice(0, 10);
  }

  function daysBetween(fromISO, toISO) {
    return Math.round((isoToUTC(toISO) - isoToUTC(fromISO)) / DAY_MS);
  }

  const dateFormatters = new Map();

  function formatDate(iso, locale, dateStyle = 'medium') {
    if (!isISODate(iso)) return '';
    const key = `${locale}|${dateStyle}`;
    let fmt = dateFormatters.get(key);
    if (!fmt) {
      try {
        fmt = new Intl.DateTimeFormat(locale, { dateStyle, timeZone: 'UTC' });
      } catch (e) {
        fmt = new Intl.DateTimeFormat(undefined, { dateStyle, timeZone: 'UTC' });
      }
      dateFormatters.set(key, fmt);
    }
    return fmt.format(isoToUTC(iso));
  }

  // Standard payment terms, in days after the issue date.
  const PAYMENT_TERMS = [0, 7, 14, 15, 30, 45, 60, 90];

  function termsLabel(days) {
    if (days === null || days === undefined || days === '') return '';
    return Number(days) === 0 ? 'Due on receipt' : `Net ${days}`;
  }

  // ---------------------------------------------------------------------------
  // Status
  // ---------------------------------------------------------------------------

  const STATUS_LABELS = { draft: 'Draft', sent: 'Sent', overdue: 'Overdue', paid: 'Paid', void: 'Void' };

  // "overdue" is never stored: it is a sent invoice whose due date has passed.
  function displayStatus(inv, today) {
    if (inv.status === 'sent' && isISODate(inv.dueDate) && inv.dueDate < today) return 'overdue';
    return inv.status;
  }

  // ---------------------------------------------------------------------------
  // Invoice numbers
  // ---------------------------------------------------------------------------

  function formatInvoiceNumber(prefix, sequence) {
    return `${prefix || ''}${String(sequence).padStart(4, '0')}`;
  }

  // The next free number: the stored counter, skipping any number already in use.
  function nextInvoiceNumber(business, invoices) {
    const taken = new Set(invoices.map((inv) => inv.number));
    let sequence = Math.max(1, Math.floor(Number(business.nextNumber)) || 1);
    while (taken.has(formatInvoiceNumber(business.invoicePrefix, sequence))) sequence += 1;
    return formatInvoiceNumber(business.invoicePrefix, sequence);
  }

  // The counter value inside a number like "INV-0042", or null if it doesn't follow the prefix.
  function sequenceOf(number, prefix) {
    const p = prefix || '';
    if (typeof number !== 'string' || !number.startsWith(p)) return null;
    const rest = number.slice(p.length);
    return /^\d{1,9}$/.test(rest) ? Number(rest) : null;
  }

  // ---------------------------------------------------------------------------
  // Dashboard summary (grouped by currency so mixed currencies are never added together)
  // ---------------------------------------------------------------------------

  function summarize(invoices, today) {
    const bucket = () => ({ count: 0, amounts: {} });
    const out = { outstanding: bucket(), overdue: bucket(), paidRecent: bucket(), draft: bucket() };
    const add = (b, currency, amount) => {
      b.count += 1;
      b.amounts[currency] = (b.amounts[currency] || 0) + amount;
    };
    const since = addDays(today, -30);
    for (const inv of invoices) {
      const totals = calcTotals(inv);
      const status = displayStatus(inv, today);
      if (status === 'sent' || status === 'overdue') add(out.outstanding, inv.currency, totals.balanceDue);
      if (status === 'overdue') add(out.overdue, inv.currency, totals.balanceDue);
      if (status === 'paid' && isISODate(inv.paidDate) && inv.paidDate >= since) {
        add(out.paidRecent, inv.currency, totals.total);
      }
      if (status === 'draft') add(out.draft, inv.currency, totals.total);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // CSV export
  // ---------------------------------------------------------------------------

  function csvCell(value) {
    if (typeof value === 'number') return String(value);
    let s = String(value == null ? '' : value);
    // Stop spreadsheets from running text such as "=HYPERLINK(...)" as a formula.
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function toCSV(rows) {
    return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
  }

  function invoicesToCSV(invoices, today) {
    const header = [
      'Invoice number', 'Status', 'Client', 'Client email', 'Reference', 'Issue date', 'Due date',
      'Paid date', 'Payment method', 'Currency', 'Subtotal', 'Discount', 'Tax', 'Total', 'Balance due',
    ];
    const rows = invoices.map((inv) => {
      const t = calcTotals(inv);
      const digits = currencyDecimals(inv.currency);
      const amount = (minor) => fromMinor(minor, inv.currency).toFixed(digits);
      return [
        inv.number, STATUS_LABELS[displayStatus(inv, today)], inv.billTo.name, inv.billTo.email,
        inv.reference, inv.issueDate, inv.dueDate, inv.paidDate || '', inv.paymentMethod || '',
        inv.currency, amount(t.subtotal), amount(t.discount), amount(t.tax), amount(t.total),
        amount(t.balanceDue),
      ];
    });
    return toCSV([header, ...rows]);
  }

  // ---------------------------------------------------------------------------
  // Brand colour
  // ---------------------------------------------------------------------------

  function hexToRgb(hex) {
    const m = /^#?([\da-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function relativeLuminance([r, g, b]) {
    const channel = (c) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function contrastRatio(a, b) {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  // Darken a brand colour until it reads as text on white paper (WCAG AA, 4.5:1).
  function readableOnWhite(hex, fallback = '#1F3A68') {
    let rgb = hexToRgb(hex);
    if (!rgb) return fallback;
    for (let i = 0; i < 30 && contrastRatio(rgb, [255, 255, 255]) < 4.5; i += 1) {
      rgb = rgb.map((c) => Math.floor(c * 0.9));
    }
    return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }

  // ---------------------------------------------------------------------------
  // Regional defaults
  // ---------------------------------------------------------------------------

  const EURO = ['AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK'];
  const REGION_CURRENCY = Object.assign(Object.fromEntries(EURO.map((r) => [r, 'EUR'])), {
    US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', CH: 'CHF', JP: 'JPY', IN: 'INR',
    SG: 'SGD', HK: 'HKD', ZA: 'ZAR', MX: 'MXN', BR: 'BRL', SE: 'SEK', NO: 'NOK', DK: 'DKK',
    PL: 'PLN', AE: 'AED', PH: 'PHP',
  });

  function guessCurrency(locale) {
    let region = '';
    try {
      region = new Intl.Locale(locale).maximize().region || '';
    } catch (e) {
      region = (String(locale || '').split(/[-_]/)[1] || '').toUpperCase();
    }
    return REGION_CURRENCY[region] || 'USD';
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  // ---------------------------------------------------------------------------
  // Invoice records
  // ---------------------------------------------------------------------------

  // The business details printed on an invoice. Frozen onto the invoice when it is
  // sent, so later changes in Settings don't rewrite invoices a client already has.
  const IDENTITY_FIELDS = ['name', 'email', 'phone', 'website', 'address', 'taxId'];

  function businessIdentity(business) {
    return Object.fromEntries(IDENTITY_FIELDS.map((key) => [key, business[key] || '']));
  }

  function emptyItem() {
    return { id: uid('item'), description: '', quantity: 1, unitPrice: 0 };
  }

  function createInvoice(business, invoices, today, overrides = {}) {
    const termsDays = Number.isInteger(business.termsDays) ? business.termsDays : 30;
    const now = new Date().toISOString();
    return {
      id: uid('inv'),
      number: nextInvoiceNumber(business, invoices),
      status: 'draft',
      clientId: null,
      billTo: { name: '', contact: '', email: '', address: '' },
      issueDate: today,
      termsDays,
      dueDate: addDays(today, termsDays),
      currency: business.currency || 'USD',
      reference: '',
      items: [emptyItem()],
      discountType: 'percent',
      discountValue: 0,
      taxLabel: business.taxLabel || 'Tax',
      taxRate: Number(business.taxRate) || 0,
      paymentInstructions: business.paymentInstructions || '',
      notes: business.notes || '',
      from: null,
      sentDate: null,
      paidDate: null,
      paymentMethod: '',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  // A fresh draft with the same client, items and terms, dated today.
  function duplicateInvoice(source, business, invoices, today) {
    const copy = createInvoice(business, invoices, today, {
      clientId: source.clientId,
      billTo: { ...source.billTo },
      currency: source.currency,
      reference: source.reference,
      items: source.items.map((item) => ({ ...item, id: uid('item') })),
      discountType: source.discountType,
      discountValue: source.discountValue,
      taxLabel: source.taxLabel,
      taxRate: source.taxRate,
      paymentInstructions: source.paymentInstructions,
      notes: source.notes,
    });
    if (Number.isInteger(source.termsDays)) {
      copy.termsDays = source.termsDays;
      copy.dueDate = addDays(today, source.termsDays);
    } else if (isISODate(source.issueDate) && isISODate(source.dueDate)) {
      // Custom due date: keep the same number of days to pay.
      copy.termsDays = null;
      copy.dueDate = addDays(today, Math.max(0, daysBetween(source.issueDate, source.dueDate)));
    }
    return copy;
  }

  return {
    businessIdentity, emptyItem, createInvoice, duplicateInvoice,
    currencyDecimals, roundHalfAway, toMinor, fromMinor, rescaleAmount, formatMoney, formatDecimal,
    decimalSeparator, parseDecimal, lineAmount, calcTotals, todayISO, isISODate, addDays,
    daysBetween, formatDate, PAYMENT_TERMS, termsLabel, STATUS_LABELS, displayStatus,
    formatInvoiceNumber, nextInvoiceNumber, sequenceOf, summarize, csvCell, toCSV, invoicesToCSV,
    hexToRgb, contrastRatio, readableOnWhite, guessCurrency, uid,
  };
});
