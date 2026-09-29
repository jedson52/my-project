/*
 * Invoicer storage. Everything lives in this browser's localStorage under one key;
 * backups are the same JSON, downloaded as a file.
 */
(function (global) {
  'use strict';

  const core = global.InvoiceCore;
  const KEY = 'invoicer.v1';
  const STATUSES = ['draft', 'sent', 'paid', 'void'];
  const locale = global.navigator ? global.navigator.language : 'en-US';

  const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
  const isoOr = (v, fallback) => (core.isISODate(v) ? v : fallback);

  function defaultBusiness() {
    return {
      name: '',
      email: '',
      phone: '',
      website: '',
      address: '',
      taxId: '',
      logo: '',
      brandColor: '#1F3A68',
      currency: core.guessCurrency(locale),
      invoicePrefix: 'INV-',
      nextNumber: 1,
      termsDays: 30,
      taxLabel: 'Tax',
      taxRate: 0,
      paymentInstructions: '',
      notes: 'Thank you for your business.',
    };
  }

  function emptyState() {
    return { version: 1, business: defaultBusiness(), clients: [], invoices: [], sample: false, lastBackupAt: null, backupSnoozedUntil: null };
  }

  function normalizeClient(c) {
    return {
      id: str(c.id) || core.uid('client'),
      name: str(c.name),
      contact: str(c.contact),
      email: str(c.email),
      phone: str(c.phone),
      address: str(c.address),
      createdAt: str(c.createdAt) || new Date().toISOString(),
    };
  }

  function normalizeInvoice(inv, today) {
    const billTo = inv.billTo || {};
    const issueDate = isoOr(inv.issueDate, today);
    return {
      id: str(inv.id) || core.uid('inv'),
      number: str(inv.number),
      status: STATUSES.includes(inv.status) ? inv.status : 'draft',
      clientId: inv.clientId ? str(inv.clientId) : null,
      billTo: { name: str(billTo.name), contact: str(billTo.contact), email: str(billTo.email), address: str(billTo.address) },
      issueDate,
      termsDays: Number.isInteger(inv.termsDays) ? inv.termsDays : null,
      dueDate: isoOr(inv.dueDate, issueDate),
      currency: str(inv.currency) || 'USD',
      reference: str(inv.reference),
      items: (Array.isArray(inv.items) ? inv.items : []).map((item) => ({
        id: str(item.id) || core.uid('item'),
        description: str(item.description),
        quantity: num(item.quantity, 1),
        unitPrice: Math.round(num(item.unitPrice)),
      })),
      discountType: inv.discountType === 'amount' ? 'amount' : 'percent',
      discountValue: Math.max(0, num(inv.discountValue)),
      taxLabel: str(inv.taxLabel) || 'Tax',
      taxRate: Math.max(0, num(inv.taxRate)),
      paymentInstructions: str(inv.paymentInstructions),
      notes: str(inv.notes),
      from: inv.from && typeof inv.from === 'object' ? core.businessIdentity(inv.from) : null,
      sentDate: core.isISODate(inv.sentDate) ? inv.sentDate : null,
      paidDate: core.isISODate(inv.paidDate) ? inv.paidDate : null,
      paymentMethod: str(inv.paymentMethod),
      createdAt: str(inv.createdAt) || new Date().toISOString(),
      updatedAt: str(inv.updatedAt) || new Date().toISOString(),
    };
  }

  // Accepts anything (saved data, a backup file, nothing) and returns a well-formed state.
  function normalize(data) {
    const base = emptyState();
    if (!data || typeof data !== 'object') return base;
    const today = core.todayISO();
    const business = { ...base.business };
    const saved = data.business && typeof data.business === 'object' ? data.business : {};
    for (const key of Object.keys(business)) {
      if (saved[key] === undefined || saved[key] === null) continue;
      business[key] = typeof business[key] === 'number' ? num(saved[key], business[key]) : str(saved[key]);
    }
    business.termsDays = Number.isInteger(business.termsDays) ? business.termsDays : 30;
    business.nextNumber = Math.max(1, Math.floor(business.nextNumber));
    return {
      version: 1,
      business,
      clients: (Array.isArray(data.clients) ? data.clients : []).filter((c) => c && typeof c === 'object').map(normalizeClient),
      invoices: (Array.isArray(data.invoices) ? data.invoices : []).filter((i) => i && typeof i === 'object').map((i) => normalizeInvoice(i, today)),
      sample: Boolean(data.sample),
      lastBackupAt: data.lastBackupAt ? str(data.lastBackupAt) : null,
      backupSnoozedUntil: core.isISODate(data.backupSnoozedUntil) ? data.backupSnoozedUntil : null,
    };
  }

  let state = emptyState();
  let persistent = true;

  const Store = {
    KEY,
    onError: () => {},

    get state() {
      return state;
    },

    // False when the browser refuses storage (private mode, blocked site data).
    get persistent() {
      return persistent;
    },

    load() {
      let raw = null;
      try {
        raw = global.localStorage.getItem(KEY);
      } catch (e) {
        persistent = false;
      }
      try {
        state = normalize(raw ? JSON.parse(raw) : null);
      } catch (e) {
        // Keep the unreadable copy rather than overwriting it, then start clean.
        try {
          global.localStorage.setItem(`${KEY}.unreadable-${Date.now()}`, raw);
        } catch (e2) { /* nothing more we can do */ }
        state = emptyState();
        Store.onError('Your saved data could not be read, so Invoicer started fresh. The old copy was kept in this browser.');
      }
      return state;
    },

    save() {
      if (!persistent) return false;
      try {
        global.localStorage.setItem(KEY, JSON.stringify(state));
        return true;
      } catch (e) {
        Store.onError(state.business.logo
          ? 'This browser is out of storage space. Try a smaller logo, or download a backup and remove old invoices.'
          : 'This browser is out of storage space. Download a backup, then remove old invoices.');
        return false;
      }
    },

    // ---- Business ----
    updateBusiness(patch) {
      Object.assign(state.business, patch);
      return Store.save();
    },

    // ---- Invoices ----
    getInvoice(id) {
      return state.invoices.find((inv) => inv.id === id) || null;
    },

    putInvoice(invoice) {
      const copy = JSON.parse(JSON.stringify(invoice));
      const index = state.invoices.findIndex((inv) => inv.id === copy.id);
      if (index === -1) state.invoices.push(copy);
      else state.invoices[index] = copy;
      const seq = core.sequenceOf(copy.number, state.business.invoicePrefix);
      if (seq !== null && seq >= state.business.nextNumber) state.business.nextNumber = seq + 1;
      return Store.save();
    },

    deleteInvoice(id) {
      const invoice = Store.getInvoice(id);
      if (!invoice) return false;
      state.invoices = state.invoices.filter((inv) => inv.id !== id);
      // Deleting the newest invoice gives its number back.
      const seq = core.sequenceOf(invoice.number, state.business.invoicePrefix);
      if (seq !== null && seq === state.business.nextNumber - 1) state.business.nextNumber = Math.max(1, seq);
      return Store.save();
    },

    isNumberTaken(number, exceptId) {
      const wanted = number.trim().toLowerCase();
      return state.invoices.some((inv) => inv.id !== exceptId && inv.number.trim().toLowerCase() === wanted);
    },

    // ---- Clients ----
    getClient(id) {
      return state.clients.find((c) => c.id === id) || null;
    },

    findClientByName(name) {
      const wanted = name.trim().toLowerCase();
      if (!wanted) return null;
      return state.clients.find((c) => c.name.trim().toLowerCase() === wanted) || null;
    },

    putClient(client) {
      const record = normalizeClient(client);
      const index = state.clients.findIndex((c) => c.id === record.id);
      if (index === -1) state.clients.push(record);
      else state.clients[index] = record;
      Store.save();
      return record;
    },

    deleteClient(id) {
      state.clients = state.clients.filter((c) => c.id !== id);
      // Invoices keep the client details printed on them; only the link goes.
      for (const inv of state.invoices) if (inv.clientId === id) inv.clientId = null;
      return Store.save();
    },

    // ---- Backups ----
    exportJSON() {
      const { sample, backupSnoozedUntil, ...data } = state;
      return JSON.stringify({ app: 'Invoicer', exportedAt: new Date().toISOString(), ...data }, null, 2);
    },

    markBackedUp() {
      state.lastBackupAt = new Date().toISOString();
      Store.save();
    },

    snoozeBackupReminder(untilISO) {
      state.backupSnoozedUntil = untilISO;
      Store.save();
    },

    // Throws with a readable message if the file isn't an Invoicer backup.
    parseBackup(text) {
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('That file isn’t a backup from Invoicer. Choose the .json file you downloaded.');
      }
      if (!data || typeof data !== 'object' || !data.business || !Array.isArray(data.invoices)) {
        throw new Error('That file isn’t a backup from Invoicer. Choose the .json file you downloaded.');
      }
      return { state: normalize(data), exportedAt: str(data.exportedAt) };
    },

    replaceAll(next) {
      state = normalize(next);
      return Store.save();
    },

    reset() {
      state = emptyState();
      return Store.save();
    },

    loadSample(today) {
      state = normalize(sampleData(today));
      return Store.save();
    },
  };

  // ---------------------------------------------------------------------------
  // Sample data: a small design studio with a few months of invoices.
  // ---------------------------------------------------------------------------

  function sampleData(today) {
    const day = (offset) => core.addDays(today, offset);
    const business = {
      ...defaultBusiness(),
      name: 'Maple & Main Design Co.',
      email: 'studio@maplemain.example',
      phone: '(512) 555-0147',
      website: 'maplemain.example',
      address: '912 Congress Avenue, Suite 410\nAustin, TX 78701',
      taxId: 'EIN 74-3829105',
      brandColor: '#1E4D5C',
      currency: 'USD',
      nextNumber: 7,
      taxLabel: 'Sales tax',
      paymentInstructions: 'Bank transfer (ACH) to Maple & Main Design Co. Account details are on your client statement.\nChecks payable to Maple & Main Design Co.',
      notes: 'Thank you for your business!',
    };
    const from = core.businessIdentity(business);
    const clients = [
      { id: 'client_riverbend', name: 'Riverbend Coffee Roasters', contact: 'Dana Whitfield', email: 'accounts@riverbendcoffee.example', phone: '(512) 555-0188', address: '1180 E 6th Street\nAustin, TX 78702' },
      { id: 'client_oakridge', name: 'Oakridge Family Dental', contact: 'Dr. Priya Raman', email: 'billing@oakridgedental.example', phone: '(512) 555-0121', address: '2201 S Lamar Blvd, Suite 200\nAustin, TX 78704' },
      { id: 'client_lonestar', name: 'Lone Star Trail Runners', contact: 'Marcus Bell', email: 'treasurer@lstrailrunners.example', phone: '', address: 'PO Box 4471\nAustin, TX 78765' },
      { id: 'client_bluebonnet', name: 'Bluebonnet Bakery', contact: 'Elena Ortiz', email: 'elena@bluebonnetbakery.example', phone: '(512) 555-0163', address: '509 W Mary Street\nAustin, TX 78704' },
    ];
    const billTo = (id) => {
      const c = clients.find((client) => client.id === id);
      return { name: c.name, contact: c.contact, email: c.email, address: c.address };
    };
    const item = (description, quantity, dollars) => ({ id: core.uid('item'), description, quantity, unitPrice: Math.round(dollars * 100) });
    const invoice = (fields) => ({
      currency: 'USD', reference: '', discountType: 'percent', discountValue: 0, taxLabel: 'Sales tax', taxRate: 0,
      paymentInstructions: business.paymentInstructions, notes: business.notes, from: null, sentDate: null,
      paidDate: null, paymentMethod: '', ...fields,
      id: `inv_sample_${fields.number}`, billTo: billTo(fields.clientId),
      dueDate: core.addDays(fields.issueDate, fields.termsDays),
    });

    const invoices = [
      invoice({
        number: 'INV-0001', status: 'paid', clientId: 'client_riverbend', issueDate: day(-58), termsDays: 30,
        sentDate: day(-58), paidDate: day(-26), paymentMethod: 'Bank transfer', from,
        items: [
          item('Brand identity refresh\nLogo redraw, color palette and typography guide', 1, 2400),
          item('Packaging label design (per coffee blend)', 3, 350),
        ],
      }),
      invoice({
        number: 'INV-0002', status: 'sent', clientId: 'client_oakridge', issueDate: day(-45), termsDays: 30,
        sentDate: day(-45), reference: 'PO 2291', discountValue: 5, from,
        items: [
          item('Website design: 6 page templates', 1, 3200),
          item('Content migration from old site (hours)', 12, 85),
        ],
      }),
      invoice({
        number: 'INV-0003', status: 'paid', clientId: 'client_lonestar', issueDate: day(-21), termsDays: 0,
        sentDate: day(-21), paidDate: day(-17), paymentMethod: 'Card', from,
        items: [
          item('Autumn Trail 10K event poster', 1, 450),
          item('Race bib layout and print-ready files', 1, 275),
        ],
      }),
      invoice({
        number: 'INV-0004', status: 'sent', clientId: 'client_bluebonnet', issueDate: day(-14), termsDays: 30,
        sentDate: day(-14), taxRate: 8.25, from,
        items: [
          item('Menu board design (3 boards)', 1, 680),
          item('Printed takeaway menus, 100 lb matte', 250, 1.9),
        ],
      }),
      invoice({
        number: 'INV-0005', status: 'sent', clientId: 'client_riverbend', issueDate: day(-5), termsDays: 14,
        sentDate: day(-5), from,
        items: [
          item('Social media post templates', 12, 45),
          item('Strategy call (hours)', 1.5, 120),
        ],
      }),
      invoice({
        number: 'INV-0006', status: 'draft', clientId: 'client_oakridge', issueDate: today, termsDays: 30,
        items: [
          item('Website care plan (monthly)', 1, 250),
          item('Additional page updates (hours)', 2, 85),
        ],
      }),
    ];

    return { version: 1, business, clients, invoices, sample: true };
  }

  Store.sampleData = sampleData;
  global.InvoiceStore = Store;
})(typeof globalThis !== 'undefined' ? globalThis : this);
