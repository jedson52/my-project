const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/core.js');
const Doc = require('../js/document.js');

const options = { locale: 'en-US', today: '2026-09-29' };

const business = {
  name: 'Rivera Plumbing LLC', email: 'office@rivera.test', phone: '(555) 010-2020', website: 'rivera.test',
  address: '12 Main St\nSpringfield', taxId: 'EIN 12-3456789', logo: '', brandColor: '#1F3A68',
  invoicePrefix: 'INV-', nextNumber: 1, currency: 'USD', termsDays: 30, taxLabel: 'Tax', taxRate: 0,
  paymentInstructions: 'Pay by check', notes: 'Thank you!',
};

function invoice(overrides = {}) {
  return core.createInvoice(business, [], '2026-09-01', {
    billTo: { name: 'Acme Co', contact: 'Jo Park', email: 'ap@acme.test', address: '9 Elm Rd' },
    items: [
      { id: 'a', description: 'Water heater install\nParts and labor', quantity: 1, unitPrice: 125000 },
      { id: 'b', description: 'Call-out fee', quantity: 1, unitPrice: 8500 },
    ],
    ...overrides,
  });
}

test('the invoice shows the business, client, items and total', () => {
  const out = String(Doc.renderInvoice(invoice(), business, options));
  assert.match(out, /Rivera Plumbing LLC/);
  assert.match(out, /Acme Co/);
  assert.match(out, /Attn: Jo Park/);
  assert.match(out, /Water heater install\nParts and labor/);
  assert.match(out, /\$1,335\.00/);
  assert.match(out, /Net 30/);
  assert.match(out, /Due Oct 1, 2026/);
  assert.match(out, /How to pay/);
  assert.doesNotMatch(out, /Discount/);
  assert.doesNotMatch(out, /doc-stamp/);
});

test('user text is escaped', () => {
  const inv = invoice({ billTo: { name: '<img src=x onerror=alert(1)>', contact: '', email: '', address: '' } });
  const out = String(Doc.renderInvoice(inv, { ...business, name: 'A & B "Co"' }, options));
  assert.doesNotMatch(out, /<img src=x/);
  assert.match(out, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(out, /A &amp; B &quot;Co&quot;/);
});

test('discount and tax rows appear only when used', () => {
  const out = String(Doc.renderInvoice(invoice({ discountValue: 10, taxRate: 8.25, taxLabel: 'Sales tax' }), business, options));
  assert.match(out, /Discount \(10%\)/);
  assert.match(out, /Sales tax \(8\.25%\)/);
});

test('empty items are left off and placeholders fill a blank invoice', () => {
  const blank = core.createInvoice({ ...business, name: '' }, [], '2026-09-01');
  const out = String(Doc.renderInvoice(blank, { ...business, name: '' }, options));
  assert.match(out, /Your business name/);
  assert.match(out, /Client name/);
  assert.match(out, /Your items will appear here/);
});

test('paid and void invoices are stamped', () => {
  const paid = String(Doc.renderInvoice(invoice({ status: 'paid', paidDate: '2026-09-15', paymentMethod: 'Card' }), business, options));
  assert.match(paid, /doc-stamp--paid/);
  assert.match(paid, /Amount paid/);
  assert.match(paid, /Paid Sep 15, 2026 · Card/);
  assert.match(paid, /Balance due/);
  const voided = String(Doc.renderInvoice(invoice({ status: 'void' }), business, options));
  assert.match(voided, /Void invoice/);
  assert.match(voided, /doc-stamp--void/);
});

test('a sent invoice keeps the business details it was sent with', () => {
  const sent = invoice({ status: 'sent', from: { ...core.businessIdentity(business), address: 'Old address' } });
  const out = String(Doc.renderInvoice(sent, { ...business, address: 'New address' }, options));
  assert.match(out, /Old address/);
  assert.doesNotMatch(out, /New address/);
});

test('email drafts fit the invoice status', () => {
  const draft = Doc.emailDraft(invoice(), business, options);
  assert.equal(draft.subject, 'Invoice INV-0001 from Rivera Plumbing LLC');
  assert.match(draft.body, /^Hi Jo Park,/);
  assert.match(draft.body, /\$1,335\.00, due by October 1, 2026/);
  assert.match(draft.body, /How to pay:\nPay by check/);

  const overdue = Doc.emailDraft(invoice({ status: 'sent', dueDate: '2026-09-20' }), business, options);
  assert.equal(overdue.subject, 'Reminder: invoice INV-0001 is past due');
  assert.match(overdue.body, /9 days ago/);

  const receipt = Doc.emailDraft(invoice({ status: 'paid', paidDate: '2026-09-15' }), business, options);
  assert.equal(receipt.subject, 'Receipt for invoice INV-0001');
  assert.match(receipt.body, /Thank you for your payment of \$1,335\.00/);
});
