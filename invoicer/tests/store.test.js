const test = require('node:test');
const assert = require('node:assert/strict');

// store.js is a browser script: give it the globals it expects.
const core = require('../js/core.js');

class MemoryStorage {
  constructor() {
    this.data = new Map();
    this.quota = Infinity;
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  }

  setItem(key, value) {
    if (String(value).length > this.quota) {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.data.set(key, String(value));
  }
}

globalThis.InvoiceCore = core;
globalThis.localStorage = new MemoryStorage();
require('../js/store.js');
const Store = globalThis.InvoiceStore;

function fresh() {
  globalThis.localStorage = new MemoryStorage();
  Store.onError = () => {};
  Store.load();
}

test('starts empty with sensible business defaults', () => {
  fresh();
  const s = Store.state;
  assert.equal(s.invoices.length, 0);
  assert.equal(s.business.invoicePrefix, 'INV-');
  assert.equal(s.business.nextNumber, 1);
  assert.equal(s.business.termsDays, 30);
});

test('saving an invoice persists it and advances the number counter', () => {
  fresh();
  const inv = core.createInvoice(Store.state.business, [], '2026-09-29');
  Store.putInvoice(inv);
  assert.equal(Store.state.business.nextNumber, 2);
  Store.load();
  assert.equal(Store.getInvoice(inv.id).number, 'INV-0001');
});

test('a hand-typed higher number moves the counter past it', () => {
  fresh();
  Store.putInvoice(core.createInvoice(Store.state.business, [], '2026-09-29', { number: 'INV-0100' }));
  assert.equal(Store.state.business.nextNumber, 101);
});

test('deleting the newest invoice gives its number back', () => {
  fresh();
  const a = core.createInvoice(Store.state.business, Store.state.invoices, '2026-09-29');
  Store.putInvoice(a);
  const b = core.createInvoice(Store.state.business, Store.state.invoices, '2026-09-29');
  Store.putInvoice(b);
  assert.equal(b.number, 'INV-0002');
  Store.deleteInvoice(b.id);
  assert.equal(Store.state.business.nextNumber, 2);
  Store.deleteInvoice(a.id);
  assert.equal(Store.state.business.nextNumber, 1);
});

test('duplicate numbers are detected case-insensitively', () => {
  fresh();
  const inv = core.createInvoice(Store.state.business, [], '2026-09-29');
  Store.putInvoice(inv);
  assert.equal(Store.isNumberTaken('inv-0001', 'other'), true);
  assert.equal(Store.isNumberTaken('INV-0001', inv.id), false);
});

test('clients are found by name and unlinked from invoices when deleted', () => {
  fresh();
  const client = Store.putClient({ name: 'Acme Co', email: 'ap@acme.test' });
  assert.equal(Store.findClientByName('  acme co ').id, client.id);
  const inv = core.createInvoice(Store.state.business, [], '2026-09-29', { clientId: client.id });
  Store.putInvoice(inv);
  Store.deleteClient(client.id);
  assert.equal(Store.getClient(client.id), null);
  assert.equal(Store.getInvoice(inv.id).clientId, null);
});

test('backups round-trip and bad files are rejected with a clear message', () => {
  fresh();
  Store.updateBusiness({ name: 'Rivera Plumbing LLC' });
  Store.putInvoice(core.createInvoice(Store.state.business, [], '2026-09-29'));
  const { state, exportedAt } = Store.parseBackup(Store.exportJSON());
  assert.equal(state.business.name, 'Rivera Plumbing LLC');
  assert.equal(state.invoices.length, 1);
  assert.ok(exportedAt);
  assert.throws(() => Store.parseBackup('not json'), /isn’t a backup from Invoicer/);
  assert.throws(() => Store.parseBackup('{"hello":1}'), /isn’t a backup from Invoicer/);
});

test('restored data is cleaned up into a valid shape', () => {
  fresh();
  const { state } = Store.parseBackup(JSON.stringify({
    business: { name: 'X', nextNumber: '12', taxRate: 'abc' },
    invoices: [{ number: 'A-1', status: 'bogus', items: [{ quantity: '2', unitPrice: '150.4' }], issueDate: 'yesterday' }, null],
    clients: 'nope',
  }));
  assert.equal(state.business.nextNumber, 12);
  assert.equal(state.business.taxRate, 0);
  assert.equal(state.clients.length, 0);
  assert.equal(state.invoices.length, 1);
  const inv = state.invoices[0];
  assert.equal(inv.status, 'draft');
  assert.equal(inv.items[0].quantity, 2);
  assert.equal(inv.items[0].unitPrice, 150);
  assert.ok(core.isISODate(inv.issueDate));
  assert.ok(inv.id);
});

test('unreadable saved data is kept aside instead of being overwritten', () => {
  fresh();
  const messages = [];
  Store.onError = (m) => messages.push(m);
  globalThis.localStorage.setItem(Store.KEY, '{broken');
  Store.load();
  assert.equal(messages.length, 1);
  const kept = [...globalThis.localStorage.data.keys()].filter((k) => k.startsWith(`${Store.KEY}.unreadable-`));
  assert.equal(kept.length, 1);
  assert.equal(Store.state.invoices.length, 0);
});

test('running out of storage is reported, not thrown', () => {
  fresh();
  const messages = [];
  Store.onError = (m) => messages.push(m);
  globalThis.localStorage.quota = 10;
  assert.equal(Store.updateBusiness({ name: 'Too big to fit' }), false);
  assert.match(messages[0], /out of storage space/);
});

test('sample data is consistent', () => {
  fresh();
  Store.loadSample('2026-09-29');
  const s = Store.state;
  assert.equal(s.sample, true);
  assert.equal(new Set(s.invoices.map((i) => i.number)).size, s.invoices.length);
  assert.equal(core.nextInvoiceNumber(s.business, s.invoices), 'INV-0007');
  for (const inv of s.invoices) assert.ok(Store.getClient(inv.clientId), inv.number);
  const summary = core.summarize(s.invoices, '2026-09-29');
  assert.equal(summary.outstanding.count, 3);
  assert.equal(summary.overdue.count, 1);
  assert.equal(summary.paidRecent.count, 2);
  assert.equal(summary.draft.count, 1);
});
