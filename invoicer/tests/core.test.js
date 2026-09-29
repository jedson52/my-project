const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');

test('rounding is half away from zero and ignores float noise', () => {
  assert.equal(core.roundHalfAway(2.5), 3);
  assert.equal(core.roundHalfAway(-2.5), -3);
  assert.equal(core.roundHalfAway(1.005 * 100), 101);
  assert.equal(Object.is(core.roundHalfAway(-0.2), 0), true);
});

test('amounts convert to and from minor units per currency', () => {
  assert.equal(core.currencyDecimals('USD'), 2);
  assert.equal(core.currencyDecimals('JPY'), 0);
  assert.equal(core.toMinor(19.99, 'USD'), 1999);
  assert.equal(core.toMinor(1.005, 'USD'), 101);
  assert.equal(core.toMinor(1500, 'JPY'), 1500);
  assert.equal(core.fromMinor(123456, 'USD'), 1234.56);
  assert.equal(core.rescaleAmount(1250, 'USD', 'JPY'), 13);
  assert.equal(core.rescaleAmount(1500, 'JPY', 'EUR'), 150000);
});

test('parseDecimal understands what people type into amount fields', () => {
  assert.equal(core.parseDecimal('$1,234.50'), 1234.5);
  assert.equal(core.parseDecimal('1.234,50', ','), 1234.5);
  assert.equal(core.parseDecimal('12,5', ','), 12.5);
  assert.equal(core.parseDecimal('(20)'), -20);
  assert.equal(core.parseDecimal('-3'), -3);
  assert.equal(core.parseDecimal(''), 0);
  assert.equal(core.parseDecimal('abc'), 0);
  assert.equal(core.parseDecimal(7.5), 7.5);
});

test('formatMoney and formatDecimal follow the locale', () => {
  assert.equal(core.formatMoney(123456, 'USD', 'en-US'), '$1,234.56');
  assert.equal(core.formatMoney(1500, 'JPY', 'en-US'), '¥1,500');
  assert.match(core.formatMoney(123456, 'EUR', 'de-DE'), /^1\.234,56\s€$/);
  assert.equal(core.formatDecimal(1250, 'en-US', { min: 2, max: 2 }), '1250.00');
  assert.equal(core.formatDecimal(1.5, 'en-US'), '1.5');
  assert.equal(core.decimalSeparator('de-DE'), ',');
  assert.equal(core.decimalSeparator('en-US'), '.');
});

test('line amounts round to the nearest minor unit', () => {
  assert.equal(core.lineAmount({ quantity: 1.5, unitPrice: 1999 }), 2999);
  assert.equal(core.lineAmount({ quantity: 0.333, unitPrice: 300 }), 100);
  assert.equal(core.lineAmount({ quantity: 250, unitPrice: 190 }), 47500);
  assert.equal(core.lineAmount({ quantity: '', unitPrice: 500 }), 0);
});

test('totals apply discount before tax', () => {
  const inv = {
    status: 'sent',
    items: [{ quantity: 2, unitPrice: 5000 }, { quantity: 1, unitPrice: 2500 }],
    discountType: 'percent',
    discountValue: 10,
    taxRate: 8.25,
  };
  assert.deepEqual(core.calcTotals(inv), {
    subtotal: 12500, discount: 1250, taxable: 11250, tax: 928, total: 12178, amountPaid: 0, balanceDue: 12178,
  });
});

test('discounts are capped and never exceed the subtotal', () => {
  const items = [{ quantity: 1, unitPrice: 1000 }];
  assert.equal(core.calcTotals({ items, discountType: 'amount', discountValue: 5000 }).total, 0);
  assert.equal(core.calcTotals({ items, discountType: 'percent', discountValue: 150 }).total, 0);
  assert.equal(core.calcTotals({ items, discountType: 'percent', discountValue: -10 }).total, 1000);
});

test('credit lines reduce the subtotal', () => {
  const t = core.calcTotals({ items: [{ quantity: 1, unitPrice: 10000 }, { quantity: 1, unitPrice: -2500 }], taxRate: 10 });
  assert.equal(t.subtotal, 7500);
  assert.equal(t.tax, 750);
  assert.equal(t.total, 8250);
});

test('paid and void invoices have nothing left to pay', () => {
  const items = [{ quantity: 1, unitPrice: 1000 }];
  const paid = core.calcTotals({ items, status: 'paid' });
  assert.equal(paid.amountPaid, 1000);
  assert.equal(paid.balanceDue, 0);
  const voided = core.calcTotals({ items, status: 'void' });
  assert.equal(voided.total, 1000);
  assert.equal(voided.balanceDue, 0);
});

test('dates are calculated without time zone drift', () => {
  assert.equal(core.addDays('2026-01-31', 30), '2026-03-02');
  assert.equal(core.addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(core.addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(core.daysBetween('2026-03-01', '2026-03-31'), 30);
  assert.equal(core.daysBetween('2026-03-31', '2026-03-01'), -30);
  assert.equal(core.isISODate('2026-02-28'), true);
  assert.equal(core.isISODate('2026-02-30'), false);
  assert.equal(core.isISODate('10/03/2026'), false);
  assert.equal(core.todayISO(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(core.formatDate('2026-10-03', 'en-US'), 'Oct 3, 2026');
  assert.equal(core.formatDate('not a date', 'en-US'), '');
});

test('payment terms have readable labels', () => {
  assert.equal(core.termsLabel(0), 'Due on receipt');
  assert.equal(core.termsLabel(30), 'Net 30');
  assert.equal(core.termsLabel(null), '');
});

test('a sent invoice past its due date shows as overdue', () => {
  const inv = { status: 'sent', dueDate: '2026-09-28' };
  assert.equal(core.displayStatus(inv, '2026-09-29'), 'overdue');
  assert.equal(core.displayStatus(inv, '2026-09-28'), 'sent');
  assert.equal(core.displayStatus({ ...inv, status: 'paid' }, '2026-10-30'), 'paid');
  assert.equal(core.displayStatus({ ...inv, status: 'draft' }, '2026-10-30'), 'draft');
});

test('invoice numbers count up and skip numbers already in use', () => {
  const business = { invoicePrefix: 'INV-', nextNumber: 3 };
  assert.equal(core.nextInvoiceNumber(business, []), 'INV-0003');
  assert.equal(core.nextInvoiceNumber(business, [{ number: 'INV-0003' }, { number: 'INV-0004' }]), 'INV-0005');
  assert.equal(core.nextInvoiceNumber({ invoicePrefix: '', nextNumber: 12345 }, []), '12345');
  assert.equal(core.sequenceOf('INV-0042', 'INV-'), 42);
  assert.equal(core.sequenceOf('INV-12a', 'INV-'), null);
  assert.equal(core.sequenceOf('Q-7', 'INV-'), null);
});

test('summary groups amounts by status and currency', () => {
  const today = '2026-09-29';
  const item = (unitPrice) => [{ quantity: 1, unitPrice }];
  const invoices = [
    { status: 'sent', currency: 'USD', dueDate: '2026-10-10', items: item(1000) },
    { status: 'sent', currency: 'USD', dueDate: '2026-09-01', items: item(2000) },
    { status: 'sent', currency: 'EUR', dueDate: '2026-10-10', items: item(500) },
    { status: 'paid', currency: 'USD', paidDate: '2026-09-20', items: item(4000) },
    { status: 'paid', currency: 'USD', paidDate: '2026-06-01', items: item(9999) },
    { status: 'draft', currency: 'USD', items: item(300) },
    { status: 'void', currency: 'USD', items: item(7777) },
  ];
  const s = core.summarize(invoices, today);
  assert.deepEqual(s.outstanding, { count: 3, amounts: { USD: 3000, EUR: 500 } });
  assert.deepEqual(s.overdue, { count: 1, amounts: { USD: 2000 } });
  assert.deepEqual(s.paidRecent, { count: 1, amounts: { USD: 4000 } });
  assert.deepEqual(s.draft, { count: 1, amounts: { USD: 300 } });
});

test('CSV cells are quoted and protected from formula injection', () => {
  assert.equal(core.csvCell('=SUM(A1:A9)'), "'=SUM(A1:A9)");
  assert.equal(core.csvCell('+1 555'), "'+1 555");
  assert.equal(core.csvCell('-12.50'), '-12.50');
  assert.equal(core.csvCell('Smith, Jones & Co'), '"Smith, Jones & Co"');
  assert.equal(core.csvCell('He said "hi"'), '"He said ""hi"""');
  assert.equal(core.csvCell(null), '');
  assert.equal(core.toCSV([['a', 1], ['b', 2]]), 'a,1\r\nb,2\r\n');
});

test('invoice CSV export has one row per invoice', () => {
  const inv = {
    number: 'INV-0001', status: 'paid', billTo: { name: 'Acme, Inc.', email: 'ap@acme.test' }, reference: 'PO 7',
    issueDate: '2026-09-01', dueDate: '2026-10-01', paidDate: '2026-09-15', paymentMethod: 'Card', currency: 'USD',
    items: [{ quantity: 2, unitPrice: 1250 }], discountType: 'percent', discountValue: 0, taxRate: 0,
  };
  const lines = core.invoicesToCSV([inv], '2026-09-29').trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^Invoice number,Status,Client/);
  assert.equal(lines[1], 'INV-0001,Paid,"Acme, Inc.",ap@acme.test,PO 7,2026-09-01,2026-10-01,2026-09-15,Card,USD,25.00,0.00,0.00,25.00,0.00');
});

test('brand colors are darkened until readable on white', () => {
  const white = [255, 255, 255];
  const fixed = core.readableOnWhite('#FFE14D');
  assert.ok(core.contrastRatio(core.hexToRgb(fixed), white) >= 4.5);
  assert.equal(core.readableOnWhite('#1F3A68'), '#1f3a68');
  assert.equal(core.readableOnWhite('not a color'), '#1F3A68');
});

test('default currency comes from the browser locale', () => {
  assert.equal(core.guessCurrency('en-US'), 'USD');
  assert.equal(core.guessCurrency('en-GB'), 'GBP');
  assert.equal(core.guessCurrency('de-DE'), 'EUR');
  assert.equal(core.guessCurrency('ja-JP'), 'JPY');
  assert.equal(core.guessCurrency('fr'), 'EUR');
  assert.equal(core.guessCurrency('en-AU'), 'AUD');
  assert.equal(core.guessCurrency('xx-QQ'), 'USD');
});

test('new invoices take the business defaults', () => {
  const business = {
    invoicePrefix: 'INV-', nextNumber: 7, currency: 'GBP', termsDays: 14, taxLabel: 'VAT', taxRate: 20,
    paymentInstructions: 'Sort code 00-00-00', notes: 'Thanks!',
  };
  const inv = core.createInvoice(business, [], '2026-09-29');
  assert.equal(inv.number, 'INV-0007');
  assert.equal(inv.status, 'draft');
  assert.equal(inv.dueDate, '2026-10-13');
  assert.equal(inv.currency, 'GBP');
  assert.equal(inv.taxLabel, 'VAT');
  assert.equal(inv.taxRate, 20);
  assert.equal(inv.paymentInstructions, 'Sort code 00-00-00');
  assert.equal(inv.items.length, 1);
});

test('duplicating an invoice makes a fresh draft dated today', () => {
  const business = { invoicePrefix: 'INV-', nextNumber: 2, currency: 'USD', termsDays: 30 };
  const source = core.createInvoice(business, [], '2026-01-10', {
    number: 'INV-0001', status: 'paid', paidDate: '2026-01-20', termsDays: null, dueDate: '2026-01-31',
    billTo: { name: 'Acme', contact: '', email: '', address: '' },
    items: [{ id: 'a', description: 'Design', quantity: 3, unitPrice: 10000 }],
  });
  const copy = core.duplicateInvoice(source, business, [source], '2026-09-29');
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.number, 'INV-0002');
  assert.equal(copy.status, 'draft');
  assert.equal(copy.paidDate, null);
  assert.equal(copy.issueDate, '2026-09-29');
  assert.equal(copy.termsDays, null);
  assert.equal(copy.dueDate, '2026-10-20'); // same 21 days to pay
  assert.equal(copy.billTo.name, 'Acme');
  assert.notEqual(copy.billTo, source.billTo);
  assert.equal(copy.items[0].description, 'Design');
  assert.notEqual(copy.items[0].id, 'a');
});
