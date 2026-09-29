/*
 * Invoicer app: screens, navigation and everything the buttons do.
 */
(function () {
  'use strict';

  const core = window.InvoiceCore;
  const { html, raw } = window.Html;
  const Doc = window.InvoiceDocument;
  const Store = window.InvoiceStore;

  // Set by the hosted preview page, where printing and file downloads are blocked.
  const DEMO = window.INVOICER_DEMO === true;

  const locale = navigator.language || 'en-US';
  const decimalSep = core.decimalSeparator(locale);
  const today = () => core.todayISO();
  const docOptions = () => ({ locale, today: today() });
  const PAPER_WIDTH = 800;

  const main = document.getElementById('main');
  const printRoot = document.getElementById('print-root');
  const dialog = document.getElementById('dialog');
  const toastRegion = document.getElementById('toasts');

  const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'JPY', 'INR', 'SGD', 'HKD', 'ZAR', 'MXN', 'BRL', 'SEK', 'NOK', 'DKK', 'PLN', 'AED', 'PHP'];
  const PAYMENT_METHODS = ['Bank transfer', 'Card', 'Cash', 'Check', 'Online payment', 'Other'];
  const BRAND_SWATCHES = ['#1F3A68', '#1E4D5C', '#2F5D3A', '#6B2D3E', '#8A4B12', '#46397A', '#2B2F36'];
  const FILTERS = [['all', 'All'], ['draft', 'Drafts'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid']];

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  const ICONS = {
    invoices: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M21.5 20a6.5 6.5 0 0 0-3.8-5.9"/>',
    settings: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
    send: '<path d="M21 3 10 14"/><path d="M21 3 14.5 21l-4.5-7-7-4.5z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
    cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  };

  const icon = (name) => raw(`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`);
  const attr = (on, name) => (on ? raw(` ${name}`) : '');
  const plural = (n, word) => `${word}${n === 1 ? '' : 's'}`;
  const fmtDate = (iso) => core.formatDate(iso, locale);
  const fmtMoney = (minor, currency) => core.formatMoney(minor, currency, locale);

  const currencyNames = (() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'currency' });
    } catch (e) {
      return null;
    }
  })();

  function currencyOptions(selected) {
    const codes = CURRENCIES.includes(selected) ? CURRENCIES : [selected, ...CURRENCIES];
    return codes.map((code) => html`<option value="${code}"${attr(code === selected, 'selected')}>${code} · ${currencyNames ? currencyNames.of(code) : code}</option>`);
  }

  function termsOptions(selected, { allowCustom }) {
    const days = [...core.PAYMENT_TERMS];
    if (Number.isInteger(selected) && !days.includes(selected)) days.push(selected);
    days.sort((a, b) => a - b);
    const options = days.map((d) => html`<option value="${d}"${attr(d === selected, 'selected')}>${core.termsLabel(d)}</option>`);
    if (allowCustom) options.push(html`<option value="custom"${attr(selected === null, 'selected')}>Custom date</option>`);
    return options;
  }

  function pill(status) {
    return html`<span class="pill pill--${status}">${core.STATUS_LABELS[status]}</span>`;
  }

  // Amounts grouped by currency, with the business's own currency first.
  function amountsList(amounts, primary) {
    const codes = Object.keys(amounts).sort((a, b) => (a === primary ? -1 : b === primary ? 1 : a.localeCompare(b)));
    if (!codes.length) return [fmtMoney(0, primary)];
    return codes.map((code) => fmtMoney(amounts[code], code));
  }

  function autoGrow(el) {
    if (!el.offsetParent) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }

  function sortedInvoices() {
    return [...Store.state.invoices].sort((a, b) => (
      b.issueDate.localeCompare(a.issueDate) || b.number.localeCompare(a.number, undefined, { numeric: true })
    ));
  }

  // ---------------------------------------------------------------------------
  // Toasts, dialogs and menus
  // ---------------------------------------------------------------------------

  function toast(message, tone = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast--${tone}`;
    el.textContent = message;
    toastRegion.append(el);
    setTimeout(() => {
      el.classList.add('toast--out');
      setTimeout(() => el.remove(), 300);
    }, tone === 'error' ? 6000 : 3200);
  }

  let settleDialog = null;

  // Shows a <form> in the modal dialog. Resolves with onSubmit's result, or null if dismissed.
  function showDialog(content, { wide = false, onSubmit, setup } = {}) {
    if (settleDialog) settleDialog(null);
    dialog.className = `dialog${wide ? ' dialog--wide' : ''}`;
    dialog.innerHTML = String(content);
    const form = dialog.querySelector('form');
    return new Promise((resolve) => {
      let settled = false;
      const settle = (value) => {
        if (settled) return;
        settled = true;
        if (settleDialog === settle) settleDialog = null;
        if (dialog.open) dialog.close();
        resolve(value);
      };
      settleDialog = settle;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = onSubmit ? onSubmit(new FormData(form), form) : true;
        if (value !== false) settle(value === undefined ? true : value);
      });
      dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => settle(null)));
      if (setup) setup(form, settle);
      if (!dialog.open) dialog.showModal();
      const first = dialog.querySelector('[autofocus]');
      if (first) first.focus();
    });
  }

  dialog.addEventListener('cancel', () => settleDialog && settleDialog(null));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog && settleDialog) settleDialog(null);
  });
  dialog.addEventListener('close', () => {
    if (!dialog.open && settleDialog) settleDialog(null);
  });

  function confirmAction({ title, message, confirmLabel, danger = false }) {
    return showDialog(html`<form class="dialog-body">
      <h2 class="dialog-title">${title}</h2>
      <p class="dialog-text">${message}</p>
      <div class="dialog-actions">
        <button type="button" class="btn" data-close${attr(danger, 'autofocus')}>Cancel</button>
        <button type="submit" class="btn ${danger ? 'btn-danger' : 'btn-primary'}"${attr(!danger, 'autofocus')}>${confirmLabel}</button>
      </div>
    </form>`).then(Boolean);
  }

  function showUnavailable(what) {
    showDialog(html`<form class="dialog-body">
      <h2 class="dialog-title">Not available in this preview</h2>
      <p class="dialog-text">This hosted preview can’t ${what}. Open Invoicer from its own folder (index.html), or from your own website, and it works as normal.</p>
      <div class="dialog-actions"><button type="submit" class="btn btn-primary" autofocus>OK</button></div>
    </form>`);
  }

  function menu(items) {
    return html`<div class="menu">
      <button type="button" class="btn btn-icon" data-action="toggle-menu" aria-haspopup="true" aria-expanded="false" aria-label="More actions">${icon('more')}</button>
      <div class="menu-list" role="menu" hidden>
        ${items.map(([action, label, iconName, danger]) => html`<button type="button" role="menuitem" class="menu-item${danger ? ' menu-item--danger' : ''}" data-action="${action}">${icon(iconName)}<span>${label}</span></button>`)}
      </div>
    </div>`;
  }

  function closeMenus(except) {
    document.querySelectorAll('.menu-list:not([hidden])').forEach((list) => {
      if (list === except) return;
      list.hidden = true;
      list.previousElementSibling.setAttribute('aria-expanded', 'false');
    });
  }

  // ---------------------------------------------------------------------------
  // Files
  // ---------------------------------------------------------------------------

  function download(filename, text, type) {
    if (DEMO) {
      showUnavailable('save files to your device');
      return false;
    }
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  }

  function downloadBackup() {
    if (download(`invoicer-backup-${today()}.json`, Store.exportJSON(), 'application/json')) {
      Store.markBackedUp();
      toast('Backup downloaded. Keep it somewhere safe, like cloud storage or email.');
      rerender();
    }
  }

  function exportCSV() {
    if (!Store.state.invoices.length) {
      toast('There are no invoices to export yet.');
      return;
    }
    // The byte-order mark makes Excel read accented characters correctly.
    const csv = `﻿${core.invoicesToCSV(sortedInvoices(), today())}`;
    if (download(`invoices-${today()}.csv`, csv, 'text/csv;charset=utf-8')) toast('Invoices exported');
  }

  const readAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('That file couldn’t be read.'));
    reader.readAsDataURL(file);
  });

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image couldn’t be opened. Try a PNG or JPG.'));
    img.src = src;
  });

  // Shrinks a logo to print-sharp size so it doesn't fill up browser storage.
  async function prepareLogo(file) {
    if (!/^image\//.test(file.type)) throw new Error('Choose an image file: PNG, JPG or SVG.');
    if (file.type === 'image/svg+xml') {
      if (file.size > 150000) throw new Error('That SVG is larger than 150 KB. Try a PNG instead.');
      return readAsDataURL(file);
    }
    const img = await loadImage(await readAsDataURL(file));
    const scale = Math.min(1, 600 / img.naturalWidth, 240 / img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return file.type === 'image/jpeg' ? canvas.toDataURL('image/jpeg', 0.9) : canvas.toDataURL('image/png');
  }

  // ---------------------------------------------------------------------------
  // Paper preview: the real-size invoice, scaled to fit its column
  // ---------------------------------------------------------------------------

  function fitPaper(stage) {
    const scaler = stage.firstElementChild;
    const width = stage.clientWidth;
    if (!width || !scaler) return;
    const scale = Math.min(1, width / PAPER_WIDTH);
    const offset = Math.max(0, (width - PAPER_WIDTH * scale) / 2);
    scaler.style.transform = `translateX(${offset}px) scale(${scale})`;
    stage.style.height = `${Math.ceil(scaler.offsetHeight * scale)}px`;
  }

  function mountPaper(stage, docHTML) {
    const scaler = stage.firstElementChild;
    scaler.innerHTML = docHTML;
    fitPaper(stage);
    scaler.querySelectorAll('img').forEach((img) => {
      if (!img.complete) img.addEventListener('load', () => fitPaper(stage), { once: true });
    });
  }

  function watchPaper(stage) {
    let lastWidth = 0;
    const observer = new ResizeObserver(() => {
      if (stage.clientWidth === lastWidth) return;
      lastWidth = stage.clientWidth;
      fitPaper(stage);
    });
    observer.observe(stage);
    if (document.fonts) document.fonts.ready.then(() => fitPaper(stage));
    return () => observer.disconnect();
  }

  // What Ctrl+P / the Print button prints. Empty means "print the page as it is".
  function preparePrint(docHTML) {
    printRoot.innerHTML = docHTML || '';
    document.documentElement.classList.toggle('print-doc', Boolean(docHTML));
  }

  function printInvoice(inv) {
    if (DEMO) {
      showUnavailable('open your browser’s print dialog');
      return;
    }
    preparePrint(String(Doc.renderInvoice(inv, Store.state.business, docOptions())));
    // The page title becomes the suggested file name when saving as PDF.
    const previousTitle = document.title;
    document.title = [inv.number, inv.billTo.name].filter(Boolean).join(' - ');
    window.addEventListener('afterprint', () => { document.title = previousTitle; }, { once: true });
    window.print();
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  let currentRoute = null;
  let leaveView = null; // cleanup for the screen being shown (saves pending edits)
  let flushEdits = null;

  function go(route) {
    currentRoute = route;
    if (location.hash !== route) {
      try {
        location.hash = route;
      } catch (e) {
        // Hash navigation can be blocked in embedded previews; rendering below still works.
      }
    }
    render();
  }

  function render() {
    if (leaveView) {
      const leave = leaveView;
      leaveView = null;
      leave();
    }
    closeMenus();
    const route = currentRoute || '#/';
    const [, section = '', id = ''] = route.match(/^#\/?([a-z]*)\/?([\w-]*)/) || [];
    document.querySelectorAll('[data-nav]').forEach((link) => {
      const active = link.dataset.nav === (section || 'invoices');
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (section === 'invoices' && id) viewEditor(id);
    else if (section === 'clients') viewClients();
    else if (section === 'settings') viewSettings();
    else viewInvoices();
    window.scrollTo(0, 0);
  }

  // Redraw the current screen in place (after a backup, say) without jumping to the top.
  function rerender() {
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  window.addEventListener('hashchange', () => {
    const route = location.hash || '#/';
    if (route === currentRoute) return;
    currentRoute = route;
    render();
  });

  // ---------------------------------------------------------------------------
  // Page notices
  // ---------------------------------------------------------------------------

  function backupDue() {
    const s = Store.state;
    if (DEMO || s.sample || s.invoices.filter((inv) => inv.status !== 'draft').length < 3) return false;
    if (s.backupSnoozedUntil && s.backupSnoozedUntil > today()) return false;
    if (!s.lastBackupAt) return true;
    return core.daysBetween(s.lastBackupAt.slice(0, 10), today()) >= 30;
  }

  function notices() {
    const s = Store.state;
    const out = [];
    if (!Store.persistent) {
      out.push(html`<div class="banner banner--bad" role="alert">${icon('info')}<span>${DEMO
        ? 'This preview can’t save to your browser, so changes last only until you close the page.'
        : 'This browser is blocking storage, so Invoicer can’t keep your work after you close the page. Allow site data for this page, or download a backup before you leave.'}</span></div>`);
    }
    if (s.sample) {
      out.push(html`<div class="banner">${icon('info')}<span><strong>You’re exploring sample data.</strong> Edit anything you like, then start fresh with your own business.</span><button type="button" class="btn btn-sm" data-action="clear-sample">Start fresh</button></div>`);
    } else if (backupDue()) {
      out.push(html`<div class="banner banner--warn">${icon('info')}<span><strong>Back up your invoices.</strong> They’re stored only in this browser. A backup file keeps them safe if this computer is lost or the browser is reset.</span><span class="banner-actions"><button type="button" class="btn btn-sm" data-action="backup-later">Later</button><button type="button" class="btn btn-sm btn-primary" data-action="backup-now">Download backup</button></span></div>`);
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Invoices list (home)
  // ---------------------------------------------------------------------------

  const listState = { filter: 'all', query: '' };

  function matchesFilter(inv, filter, t) {
    const status = core.displayStatus(inv, t);
    if (filter === 'unpaid') return status === 'sent' || status === 'overdue';
    if (filter === 'all') return true;
    return status === filter;
  }

  function statTile(label, bucket, tone, meta) {
    const [first, ...rest] = amountsList(bucket.amounts, Store.state.business.currency);
    return html`<div class="stat stat--${tone}${bucket.count ? '' : ' stat--zero'}">
      <div class="stat-label">${label}</div>
      <div class="stat-value">${first}</div>
      ${rest.length ? html`<div class="stat-extra">+ ${rest.join(' + ')}</div>` : ''}
      <div class="stat-meta">${meta(bucket.count)}</div>
    </div>`;
  }

  function dueHint(inv, status, t) {
    if (status === 'paid') return { text: `Paid ${fmtDate(inv.paidDate)}`, tone: 'ok' };
    if (status === 'void') return { text: 'Void', tone: '' };
    if (status === 'draft') return { text: 'Not sent yet', tone: '' };
    const days = core.daysBetween(t, inv.dueDate);
    if (days < 0) return { text: `${-days} ${plural(-days, 'day')} overdue`, tone: 'bad' };
    if (days === 0) return { text: 'Due today', tone: 'warn' };
    return { text: `Due in ${days} ${plural(days, 'day')}`, tone: days <= 7 ? 'warn' : '' };
  }

  function viewInvoices() {
    const { business, invoices } = Store.state;
    if (!business.name && !invoices.length) {
      viewWelcome();
      return;
    }
    const t = today();
    const summary = core.summarize(invoices, t);
    const counts = Object.fromEntries(FILTERS.map(([key]) => [key, invoices.filter((inv) => matchesFilter(inv, key, t)).length]));

    main.innerHTML = String(html`<div class="page">
      ${notices()}
      <header class="page-head">
        <div>
          <h1 class="page-title">Invoices</h1>
          <p class="page-sub">${business.name || 'Your business'}</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="new-invoice">${icon('plus')}<span>New invoice</span></button>
      </header>

      <section class="stats" aria-label="Summary">
        ${statTile('Outstanding', summary.outstanding, 'sent', (n) => (n ? `${n} ${plural(n, 'invoice')} awaiting payment` : 'Nothing awaiting payment'))}
        ${statTile('Overdue', summary.overdue, 'overdue', (n) => (n ? `${n} past the due date` : 'Nothing overdue'))}
        ${statTile('Paid', summary.paidRecent, 'paid', (n) => `${n} in the last 30 days`)}
        ${statTile('Drafts', summary.draft, 'draft', (n) => `${n} not sent yet`)}
      </section>

      <section class="panel">
        <div class="toolbar">
          <div class="filters" role="group" aria-label="Show">
            ${FILTERS.map(([key, label]) => html`<button type="button" class="filter" data-filter="${key}" aria-pressed="${listState.filter === key}">${label}<span class="filter-count">${counts[key]}</span></button>`)}
          </div>
          <label class="search">
            <span class="sr-only">Search invoices</span>
            ${icon('search')}
            <input type="search" id="invoice-search" placeholder="Search client, number or reference" value="${listState.query}">
          </label>
        </div>
        <div id="invoice-list"></div>
      </section>
    </div>`);

    renderInvoiceList();

    main.querySelector('.filters').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn) return;
      listState.filter = btn.dataset.filter;
      main.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      renderInvoiceList();
    });
    main.querySelector('#invoice-search').addEventListener('input', (e) => {
      listState.query = e.target.value;
      renderInvoiceList();
    });
  }

  function renderInvoiceList() {
    const container = main.querySelector('#invoice-list');
    const t = today();
    const q = listState.query.trim().toLowerCase();
    const all = Store.state.invoices;
    const rows = sortedInvoices()
      .filter((inv) => matchesFilter(inv, listState.filter, t))
      .filter((inv) => !q || [inv.number, inv.billTo.name, inv.reference].some((v) => v.toLowerCase().includes(q)));

    if (!rows.length) {
      const messages = {
        all: 'No invoices yet.',
        draft: 'No drafts. Every invoice has been sent.',
        unpaid: 'No unpaid invoices. You’re all caught up.',
        overdue: 'Nothing is overdue.',
        paid: 'No paid invoices yet.',
      };
      container.innerHTML = String(html`<div class="empty">
        <p class="empty-title">${q ? `No invoices match “${listState.query.trim()}”.` : messages[listState.filter]}</p>
        ${!all.length ? html`<p class="empty-text">Create your first invoice. It takes about two minutes.</p>
          <button type="button" class="btn btn-primary" data-action="new-invoice">${icon('plus')}<span>New invoice</span></button>` : ''}
      </div>`);
      return;
    }

    container.innerHTML = String(html`<div class="table-wrap"><table class="table invoice-table">
      <thead><tr>
        <th scope="col">Number</th><th scope="col">Client</th><th scope="col">Issued</th>
        <th scope="col">Due</th><th scope="col" class="num">Amount</th><th scope="col">Status</th>
      </tr></thead>
      <tbody>${rows.map((inv) => {
        const status = core.displayStatus(inv, t);
        const hint = dueHint(inv, status, t);
        return html`<tr data-href="#/invoices/${inv.id}">
          <td class="c-number"><a class="row-link mono" href="#/invoices/${inv.id}">${inv.number || 'No number'}</a></td>
          <td class="c-client"><span class="cell-main">${inv.billTo.name || 'No client yet'}</span>${inv.reference ? html`<span class="cell-sub">${inv.reference}</span>` : ''}</td>
          <td class="c-issued">${fmtDate(inv.issueDate)}</td>
          <td class="c-due"><span class="cell-main">${fmtDate(inv.dueDate)}</span><span class="cell-sub tone-${hint.tone || 'none'}">${hint.text}</span></td>
          <td class="c-amount num">${fmtMoney(core.calcTotals(inv).total, inv.currency)}</td>
          <td class="c-status">${pill(status)}</td>
        </tr>`;
      })}</tbody>
    </table></div>`);
  }

  // ---------------------------------------------------------------------------
  // Welcome (first run)
  // ---------------------------------------------------------------------------

  function viewWelcome() {
    const business = Store.state.business;
    main.innerHTML = String(html`<div class="welcome">
      ${notices()}
      <div class="welcome-copy">
        <p class="eyebrow">Welcome to Invoicer</p>
        <h1 class="welcome-title">Send a professional invoice in about two minutes.</h1>
        <p class="welcome-lead">Start with your business name. It goes on every invoice, together with the logo, address and payment details you can add later in Settings.</p>
        <form id="welcome-form" class="card welcome-form" novalidate>
          <label class="field">
            <span class="field-label">Business name</span>
            <input id="welcome-name" name="name" autocomplete="organization" placeholder="e.g. Rivera Plumbing LLC" required>
          </label>
          <div class="grid grid-2">
            <label class="field">
              <span class="field-label">Business email <span class="optional">optional</span></span>
              <input id="welcome-email" name="email" type="email" autocomplete="email" placeholder="you@yourbusiness.com">
            </label>
            <label class="field">
              <span class="field-label">Currency</span>
              <select id="welcome-currency" name="currency">${currencyOptions(business.currency)}</select>
            </label>
          </div>
          <p class="field-error" id="welcome-error" hidden>Enter your business name to continue.</p>
          <button class="btn btn-primary btn-lg" type="submit">Create my first invoice</button>
        </form>
        <p class="welcome-alt">Just looking? <button type="button" class="link-btn" data-action="load-sample">Explore with sample data</button></p>
      </div>
      <figure class="welcome-preview">
        <div class="paper-stage" id="welcome-paper"><div class="paper-scale"></div></div>
        <figcaption>Your invoice updates as you type.</figcaption>
      </figure>
    </div>`);

    const form = main.querySelector('#welcome-form');
    const stage = main.querySelector('#welcome-paper');
    const example = Store.sampleData(today()).invoices.find((inv) => inv.number === 'INV-0004');

    const paint = () => {
      const currency = form.elements.currency.value;
      const previewBusiness = { ...business, name: form.elements.namedItem('name').value.trim(), email: form.elements.email.value.trim(), currency };
      const inv = {
        ...example,
        number: core.formatInvoiceNumber(business.invoicePrefix, 1),
        status: 'draft',
        from: null,
        currency,
        items: example.items.map((item) => ({ ...item, unitPrice: core.rescaleAmount(item.unitPrice, 'USD', currency) })),
        paymentInstructions: '',
        notes: business.notes,
      };
      mountPaper(stage, String(Doc.renderInvoice(inv, previewBusiness, docOptions())));
    };
    paint();
    const unwatch = watchPaper(stage);
    leaveView = unwatch;
    form.addEventListener('input', paint);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.elements.namedItem('name').value.trim();
      if (!name) {
        main.querySelector('#welcome-error').hidden = false;
        form.elements.namedItem('name').setAttribute('aria-invalid', 'true');
        form.elements.namedItem('name').focus();
        return;
      }
      Store.updateBusiness({ name, email: form.elements.email.value.trim(), currency: form.elements.currency.value });
      startNewInvoice();
    });
    form.elements.namedItem('name').focus();
  }

  // ---------------------------------------------------------------------------
  // Invoice editor
  // ---------------------------------------------------------------------------

  let pendingDraft = null; // a new invoice that hasn't been saved yet

  function startNewInvoice(overrides = {}) {
    const s = Store.state;
    pendingDraft = core.createInvoice(s.business, s.invoices, today(), overrides);
    go(`#/invoices/${pendingDraft.id}`);
  }

  function startInvoiceFor(client) {
    startNewInvoice({
      clientId: client.id,
      billTo: { name: client.name, contact: client.contact, email: client.email, address: client.address },
    });
  }

  function formatRate(minor, currency) {
    if (!minor) return '';
    const digits = core.currencyDecimals(currency);
    return core.formatDecimal(core.fromMinor(minor, currency), locale, { min: digits, max: digits });
  }

  function discountText(inv) {
    if (!inv.discountValue) return '';
    return inv.discountType === 'amount' ? formatRate(inv.discountValue, inv.currency) : core.formatDecimal(inv.discountValue, locale);
  }

  function itemRow(item, currency) {
    return html`<div class="item-row" data-id="${item.id}">
      <div class="item-desc">
        <label class="sr-only" for="desc-${item.id}">Description</label>
        <textarea id="desc-${item.id}" name="desc" rows="1" data-grow placeholder="Describe the work or product">${item.description}</textarea>
      </div>
      <div class="item-qty">
        <label class="sr-only" for="qty-${item.id}">Quantity</label>
        <input id="qty-${item.id}" name="qty" inputmode="decimal" value="${core.formatDecimal(item.quantity, locale)}" placeholder="Qty">
      </div>
      <div class="item-rate">
        <label class="sr-only" for="rate-${item.id}">Rate</label>
        <input id="rate-${item.id}" name="rate" inputmode="decimal" value="${formatRate(item.unitPrice, currency)}" placeholder="Rate">
      </div>
      <div class="item-amount" data-amount>${fmtMoney(core.lineAmount(item), currency)}</div>
      <button type="button" class="btn btn-ghost btn-icon item-remove" data-action="remove-item" aria-label="Remove item">${icon('x')}</button>
    </div>`;
  }

  function editorTemplate(inv) {
    const business = Store.state.business;
    const needsDetails = !business.address && !business.paymentInstructions;
    return html`<div class="editor" data-view="edit">
      <div class="editor-bar">
        <a class="btn btn-ghost btn-back" href="#/">${icon('back')}<span class="hide-sm">Invoices</span></a>
        <div class="editor-title">
          <h1 class="editor-number" id="editor-number"></h1>
          <span id="editor-status"></span>
        </div>
        <span class="save-state" id="save-state" aria-live="polite"></span>
        <div class="editor-actions" id="editor-actions"></div>
      </div>

      <div class="view-switch" role="group" aria-label="Show">
        <button type="button" data-view="edit" aria-pressed="true">${icon('edit')}Edit</button>
        <button type="button" data-view="preview" aria-pressed="false">${icon('eye')}Preview</button>
      </div>

      <div class="editor-grid">
        <form class="editor-form" id="invoice-form" autocomplete="off" novalidate>
          <div id="editor-banner"></div>
          <fieldset id="invoice-fields">
            <legend class="sr-only">Invoice</legend>

            <p class="from-line">From <strong>${business.name || 'your business'}</strong> ·
              <a href="#/settings">${needsDetails ? 'Add your address, logo and payment details' : 'Edit business details'}</a></p>

            <section class="card form-section" aria-labelledby="h-billto">
              <h2 class="section-title" id="h-billto">Bill to</h2>
              <div class="grid grid-2">
                <label class="field span-2">
                  <span class="field-label">Client name</span>
                  <input id="inv-client-name" name="billTo.name" list="client-options" value="${inv.billTo.name}" placeholder="Company or person you’re billing" autocomplete="off">
                  <span class="hint">Start typing to pick a saved client. New clients are saved for next time.</span>
                </label>
                <label class="field">
                  <span class="field-label">Contact person <span class="optional">optional</span></span>
                  <input id="inv-contact" name="billTo.contact" value="${inv.billTo.contact}">
                </label>
                <label class="field">
                  <span class="field-label">Email</span>
                  <input id="inv-email" name="billTo.email" type="email" value="${inv.billTo.email}" placeholder="billing@client.com">
                </label>
                <label class="field span-2">
                  <span class="field-label">Billing address</span>
                  <textarea id="inv-address" name="billTo.address" rows="2" data-grow>${inv.billTo.address}</textarea>
                </label>
              </div>
              <datalist id="client-options"></datalist>
            </section>

            <section class="card form-section" aria-labelledby="h-details">
              <h2 class="section-title" id="h-details">Details</h2>
              <div class="grid grid-3">
                <label class="field">
                  <span class="field-label">Invoice number</span>
                  <input id="inv-number" name="number" class="mono" value="${inv.number}">
                </label>
                <label class="field">
                  <span class="field-label">Issue date</span>
                  <input id="inv-issue" name="issueDate" type="date" value="${inv.issueDate}">
                </label>
                <label class="field">
                  <span class="field-label">Payment terms</span>
                  <select id="inv-terms" name="termsDays">${termsOptions(inv.termsDays, { allowCustom: true })}</select>
                </label>
                <label class="field">
                  <span class="field-label">Due date</span>
                  <input id="inv-due" name="dueDate" type="date" value="${inv.dueDate}">
                </label>
                <label class="field">
                  <span class="field-label">Currency</span>
                  <select id="inv-currency" name="currency">${currencyOptions(inv.currency)}</select>
                </label>
                <label class="field">
                  <span class="field-label">PO / reference <span class="optional">optional</span></span>
                  <input id="inv-reference" name="reference" value="${inv.reference}">
                </label>
              </div>
              <p class="field-error" id="number-warning" hidden></p>
            </section>

            <section class="card form-section" aria-labelledby="h-items">
              <h2 class="section-title" id="h-items">Items</h2>
              <div class="items">
                <div class="items-head" aria-hidden="true"><span>Description</span><span>Qty</span><span>Rate</span><span>Amount</span><span></span></div>
                <div id="item-list" class="item-list"></div>
                <button type="button" class="btn btn-add" data-action="add-item">${icon('plus')}Add item</button>
              </div>
              <div class="totals-row">
                <div class="adjustments">
                  <div class="field">
                    <label class="field-label" for="inv-discount">Discount</label>
                    <div class="input-group">
                      <input id="inv-discount" name="discountValue" inputmode="decimal" value="${discountText(inv)}" placeholder="0">
                      <select id="inv-discount-type" name="discountType" aria-label="Discount type">
                        <option value="percent"${attr(inv.discountType === 'percent', 'selected')}>%</option>
                        <option value="amount"${attr(inv.discountType === 'amount', 'selected')}>${inv.currency}</option>
                      </select>
                    </div>
                  </div>
                  <div class="field">
                    <label class="field-label" for="inv-tax-rate">Tax</label>
                    <div class="input-group">
                      <input id="inv-tax-label" name="taxLabel" class="input-tax-name" value="${inv.taxLabel}" aria-label="Tax name, for example VAT or GST">
                      <input id="inv-tax-rate" name="taxRate" inputmode="decimal" value="${inv.taxRate ? core.formatDecimal(inv.taxRate, locale) : ''}" placeholder="0">
                      <span class="input-suffix" aria-hidden="true">%</span>
                    </div>
                  </div>
                </div>
                <dl class="sum" id="form-totals"></dl>
              </div>
            </section>

            <section class="card form-section" aria-labelledby="h-notes">
              <h2 class="section-title" id="h-notes">Payment &amp; notes</h2>
              <label class="field">
                <span class="field-label">How to pay</span>
                <textarea id="inv-payment" name="paymentInstructions" rows="3" data-grow placeholder="e.g. Bank transfer to Account 12345678, or pay by card at yoursite.com/pay">${inv.paymentInstructions}</textarea>
                <span class="hint">Set a default in <a href="#/settings">Settings</a> so every invoice includes it.</span>
              </label>
              <label class="field">
                <span class="field-label">Notes to client <span class="optional">optional</span></span>
                <textarea id="inv-notes" name="notes" rows="2" data-grow>${inv.notes}</textarea>
              </label>
            </section>
          </fieldset>
        </form>

        <aside class="editor-preview" aria-label="Invoice preview">
          <div class="preview-caption"><span>Preview</span><span>Exactly what your client receives</span></div>
          <div class="paper-stage" id="editor-paper"><div class="paper-scale"></div></div>
        </aside>
      </div>
    </div>`;
  }

  function viewEditor(id) {
    const stored = Store.getInvoice(id);
    const source = stored || (pendingDraft && pendingDraft.id === id ? pendingDraft : null);
    if (!source) {
      toast('That invoice isn’t here anymore.');
      go('#/');
      return;
    }

    const ed = {
      inv: JSON.parse(JSON.stringify(source)),
      persisted: Boolean(stored),
      dirty: false,
      timer: 0,
      createdClientId: null, // a client this editing session added, so a corrected name renames it
    };

    main.innerHTML = String(editorTemplate(ed.inv));
    const root = main.querySelector('.editor');
    const form = root.querySelector('#invoice-form');
    const fieldset = form.querySelector('fieldset');
    const itemList = root.querySelector('#item-list');
    const stage = root.querySelector('#editor-paper');
    const $ = (selector) => root.querySelector(selector);
    const field = (name) => form.elements.namedItem(name);
    const money = (minor) => fmtMoney(minor, ed.inv.currency);

    // ---- Rendering ----

    function renderItems() {
      itemList.innerHTML = String(html`${ed.inv.items.map((item) => itemRow(item, ed.inv.currency))}`);
      root.querySelectorAll('textarea[data-grow]').forEach(autoGrow);
    }

    function renderTotals() {
      const inv = ed.inv;
      const t = core.calcTotals(inv);
      $('#form-totals').innerHTML = String(html`
        <dt>Subtotal</dt><dd>${money(t.subtotal)}</dd>
        ${t.discount ? html`<dt>Discount</dt><dd>−${money(t.discount)}</dd>` : ''}
        ${inv.taxRate ? html`<dt>${inv.taxLabel || 'Tax'}</dt><dd>${money(t.tax)}</dd>` : ''}
        <dt class="sum-total">Total</dt><dd class="sum-total">${money(t.total)}</dd>`);
    }

    function renderPreview() {
      const docHTML = String(Doc.renderInvoice(ed.inv, Store.state.business, docOptions()));
      mountPaper(stage, docHTML);
      preparePrint(docHTML);
    }

    let paintQueued = false;
    function schedulePaint() {
      if (paintQueued) return;
      paintQueued = true;
      requestAnimationFrame(() => {
        paintQueued = false;
        renderTotals();
        renderPreview();
      });
    }

    function renderClientOptions() {
      $('#client-options').innerHTML = String(html`${[...Store.state.clients]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => html`<option value="${c.name}"></option>`)}`);
    }

    function renderSaveState(state) {
      const el = $('#save-state');
      el.dataset.state = state;
      el.innerHTML = String({
        saving: html`Saving…`,
        saved: html`${icon('check')}Saved`,
        error: html`Not saved`,
        new: html`Saves as you type`,
      }[state]);
    }

    function statusBanner(inv, status) {
      if (status === 'paid') {
        return html`<div class="banner banner--ok">${icon('check')}<span><strong>Paid ${fmtDate(inv.paidDate)}</strong>${inv.paymentMethod ? ` by ${inv.paymentMethod.toLowerCase()}` : ''}. Paid invoices are locked so your records stay accurate.</span><button type="button" class="btn btn-sm" data-action="mark-unpaid">${icon('undo')}Mark as unpaid</button></div>`;
      }
      if (status === 'void') {
        return html`<div class="banner banner--muted">${icon('ban')}<span><strong>This invoice is void.</strong> It stays in your records but no longer counts as money owed.</span><button type="button" class="btn btn-sm" data-action="restore">${icon('undo')}Restore</button></div>`;
      }
      if (status === 'overdue') {
        const late = core.daysBetween(inv.dueDate, today());
        return html`<div class="banner banner--bad">${icon('info')}<span><strong>${late} ${plural(late, 'day')} overdue.</strong> A short, friendly reminder usually does the trick.</span><button type="button" class="btn btn-sm" data-action="email">${icon('mail')}Send reminder</button></div>`;
      }
      if (status === 'sent') {
        return html`<div class="banner">${icon('send')}<span>${inv.sentDate ? `Sent ${fmtDate(inv.sentDate)}` : 'Sent'}. When the money arrives, record the payment to mark it paid.</span></div>`;
      }
      return '';
    }

    function actionButtons(status) {
      const email = html`<button type="button" class="btn" data-action="email">${icon('mail')}<span class="hide-sm">${status === 'overdue' ? 'Reminder' : status === 'paid' ? 'Receipt' : 'Email'}</span></button>`;
      const print = html`<button type="button" class="btn" data-action="print">${icon('print')}<span class="hide-sm">Print / PDF</span></button>`;
      const del = ['delete', 'Delete', 'trash', true];
      const dup = ['duplicate', 'Duplicate', 'copy'];
      if (status === 'draft') {
        return html`${email}${print}<button type="button" class="btn btn-primary" data-action="mark-sent">${icon('send')}Mark as sent</button>
          ${menu([dup, ['record-payment', 'Record payment', 'cash'], del])}`;
      }
      if (status === 'sent' || status === 'overdue') {
        return html`${email}${print}<button type="button" class="btn btn-primary" data-action="record-payment">${icon('cash')}Record payment</button>
          ${menu([dup, ['revert-draft', 'Move back to drafts', 'undo'], ['void', 'Void invoice', 'ban'], del])}`;
      }
      if (status === 'paid') return html`${email}${print}${menu([dup, ['mark-unpaid', 'Mark as unpaid', 'undo'], del])}`;
      return html`${print}${menu([dup, ['restore', 'Restore', 'undo'], del])}`;
    }

    function renderChrome() {
      const inv = ed.inv;
      const status = core.displayStatus(inv, today());
      $('#editor-number').textContent = inv.number || 'Untitled invoice';
      $('#editor-status').innerHTML = String(pill(status));
      $('#editor-banner').innerHTML = String(statusBanner(inv, status));
      $('#editor-actions').innerHTML = String(actionButtons(status));
      fieldset.disabled = inv.status === 'paid' || inv.status === 'void';
    }

    function checkNumber() {
      const number = ed.inv.number.trim();
      const warning = $('#number-warning');
      let message = '';
      if (!number) message = 'Give this invoice a number.';
      else if (Store.isNumberTaken(number, ed.inv.id)) message = `Another invoice already uses ${number}. Clients and accountants expect every number to be unique.`;
      warning.textContent = message;
      warning.hidden = !message;
      field('number').setAttribute('aria-invalid', String(Boolean(message)));
    }

    // ---- Saving ----

    function save() {
      clearTimeout(ed.timer);
      if (!ed.dirty) return true;
      ed.dirty = false;
      ed.inv.updatedAt = new Date().toISOString();
      const ok = Store.putInvoice(ed.inv);
      if (!ed.persisted) {
        ed.persisted = true;
        if (pendingDraft && pendingDraft.id === ed.inv.id) pendingDraft = null;
      }
      renderSaveState(ok ? 'saved' : 'error');
      return ok;
    }

    function commit() {
      ed.dirty = true;
      return save();
    }

    function changed() {
      ed.dirty = true;
      clearTimeout(ed.timer);
      ed.timer = setTimeout(save, 600);
      renderSaveState('saving');
      schedulePaint();
    }

    function refresh() {
      renderChrome();
      renderTotals();
      renderPreview();
    }

    // ---- Clients ----

    function fillFromClient(client) {
      for (const key of ['contact', 'email', 'address']) {
        if (!client[key]) continue;
        ed.inv.billTo[key] = client[key];
        field(`billTo.${key}`).value = client[key];
      }
    }

    // While typing: link to a saved client as soon as the name matches one.
    function linkClientByName() {
      const inv = ed.inv;
      if (!inv.billTo.name.trim()) {
        inv.clientId = null;
        return;
      }
      const match = Store.findClientByName(inv.billTo.name);
      if (match && match.id !== inv.clientId) {
        inv.clientId = match.id;
        fillFromClient(match);
      }
    }

    // When the name field is left: save a new client, or rename the one just created here.
    function settleClient() {
      const inv = ed.inv;
      const name = inv.billTo.name.trim();
      if (!name) return;
      const match = Store.findClientByName(name);
      if (match) {
        if (match.id !== inv.clientId) {
          inv.clientId = match.id;
          fillFromClient(match);
        }
        if (inv.billTo.name !== match.name) {
          inv.billTo.name = match.name;
          field('billTo.name').value = match.name;
        }
        return;
      }
      const own = ed.createdClientId && inv.clientId === ed.createdClientId ? Store.getClient(ed.createdClientId) : null;
      if (own) {
        Store.putClient({ ...own, name });
      } else {
        const client = Store.putClient({ name, contact: inv.billTo.contact, email: inv.billTo.email, address: inv.billTo.address });
        ed.createdClientId = client.id;
        inv.clientId = client.id;
      }
      renderClientOptions();
    }

    // Keep the saved client's contact details in step with what's typed here.
    function updateClientRecord() {
      const client = ed.inv.clientId && Store.getClient(ed.inv.clientId);
      if (!client) return;
      const { contact, email, address } = ed.inv.billTo;
      Store.putClient({ ...client, contact, email, address });
    }

    // ---- Items ----

    function addItem() {
      const item = core.emptyItem();
      ed.inv.items.push(item);
      itemList.insertAdjacentHTML('beforeend', String(itemRow(item, ed.inv.currency)));
      itemList.lastElementChild.querySelector('textarea').focus();
      changed();
    }

    function removeItem(row) {
      const next = row.nextElementSibling || row.previousElementSibling;
      ed.inv.items = ed.inv.items.filter((item) => item.id !== row.dataset.id);
      if (!ed.inv.items.length) ed.inv.items.push(core.emptyItem());
      renderItems();
      const focusRow = next && itemList.querySelector(`[data-id="${next.dataset.id}"]`);
      (focusRow ? focusRow.querySelector('textarea') : itemList.querySelector('textarea')).focus();
      changed();
    }

    function readDiscount(text) {
      const n = Math.max(0, core.parseDecimal(text, decimalSep));
      return ed.inv.discountType === 'amount' ? core.toMinor(n, ed.inv.currency) : Math.min(n, 100);
    }

    function changeCurrency(code) {
      const inv = ed.inv;
      const previous = inv.currency;
      if (code === previous) return;
      inv.items.forEach((item) => { item.unitPrice = core.rescaleAmount(item.unitPrice, previous, code); });
      if (inv.discountType === 'amount') inv.discountValue = core.rescaleAmount(inv.discountValue, previous, code);
      inv.currency = code;
      field('discountType').options[1].textContent = code;
      field('discountValue').value = discountText(inv);
      renderItems();
    }

    // ---- Form events ----

    form.addEventListener('submit', (e) => e.preventDefault());

    form.addEventListener('input', (e) => {
      const el = e.target;
      if (el.tagName === 'SELECT') return; // selects are handled on change
      el.removeAttribute('aria-invalid');
      if (el.matches('textarea[data-grow]')) autoGrow(el);
      const inv = ed.inv;
      const row = el.closest('.item-row');
      if (row) {
        const item = inv.items.find((it) => it.id === row.dataset.id);
        if (!item) return;
        if (el.name === 'desc') {
          item.description = el.value;
        } else if (el.name === 'qty') {
          item.quantity = core.parseDecimal(el.value, decimalSep);
        } else if (el.name === 'rate') {
          item.unitPrice = core.toMinor(core.parseDecimal(el.value, decimalSep), inv.currency);
        }
        row.querySelector('[data-amount]').textContent = money(core.lineAmount(item));
        changed();
        return;
      }
      switch (el.name) {
        case 'billTo.name':
          inv.billTo.name = el.value;
          linkClientByName();
          break;
        case 'billTo.contact':
        case 'billTo.email':
        case 'billTo.address':
          inv.billTo[el.name.slice('billTo.'.length)] = el.value;
          break;
        case 'number':
          inv.number = el.value;
          $('#editor-number').textContent = el.value || 'Untitled invoice';
          checkNumber();
          break;
        case 'issueDate':
          if (!core.isISODate(el.value)) return;
          inv.issueDate = el.value;
          if (Number.isInteger(inv.termsDays)) {
            inv.dueDate = core.addDays(el.value, inv.termsDays);
            field('dueDate').value = inv.dueDate;
          }
          break;
        case 'dueDate': {
          if (!core.isISODate(el.value)) return;
          inv.dueDate = el.value;
          const gap = core.daysBetween(inv.issueDate, inv.dueDate);
          inv.termsDays = core.PAYMENT_TERMS.includes(gap) ? gap : null;
          field('termsDays').value = inv.termsDays === null ? 'custom' : String(inv.termsDays);
          break;
        }
        case 'reference':
        case 'notes':
        case 'paymentInstructions':
        case 'taxLabel':
          inv[el.name] = el.value;
          break;
        case 'discountValue':
          inv.discountValue = readDiscount(el.value);
          break;
        case 'taxRate':
          inv.taxRate = Math.max(0, core.parseDecimal(el.value, decimalSep));
          break;
        default:
          return;
      }
      changed();
    });

    form.addEventListener('change', (e) => {
      const el = e.target;
      const inv = ed.inv;
      const row = el.closest('.item-row');
      if (row) {
        // Show how the number was understood, e.g. "1,250" becomes "1250.00".
        const item = inv.items.find((it) => it.id === row.dataset.id);
        if (item && el.name === 'qty') el.value = core.formatDecimal(item.quantity, locale);
        if (item && el.name === 'rate') el.value = formatRate(item.unitPrice, inv.currency);
        return;
      }
      switch (el.name) {
        case 'billTo.name':
          settleClient();
          break;
        case 'billTo.contact':
        case 'billTo.email':
        case 'billTo.address':
          updateClientRecord();
          return;
        case 'termsDays':
          if (el.value === 'custom') {
            inv.termsDays = null;
          } else {
            inv.termsDays = Number(el.value);
            inv.dueDate = core.addDays(inv.issueDate, inv.termsDays);
            field('dueDate').value = inv.dueDate;
          }
          break;
        case 'currency':
          changeCurrency(el.value);
          break;
        case 'discountType':
          inv.discountType = el.value;
          inv.discountValue = readDiscount(field('discountValue').value);
          break;
        case 'discountValue':
          el.value = discountText(inv);
          return;
        case 'taxRate':
          el.value = inv.taxRate ? core.formatDecimal(inv.taxRate, locale) : '';
          return;
        default:
          return;
      }
      changed();
    });

    // Enter in a quantity or rate moves to the next line, adding one at the end.
    form.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.target.tagName === 'TEXTAREA') return;
      const row = e.target.closest('.item-row');
      if (!row) return;
      e.preventDefault();
      const next = row.nextElementSibling;
      if (next) next.querySelector('textarea').focus();
      else addItem();
    });

    // ---- Actions ----

    function ensureReady() {
      const inv = ed.inv;
      let problem = null;
      if (!Store.state.business.name) {
        toast('Add your business name in Settings first.', 'error');
        return false;
      }
      if (!inv.billTo.name.trim()) {
        problem = ['Add who this invoice is for.', field('billTo.name')];
      } else if (!inv.items.some((it) => it.description.trim() && core.lineAmount(it) !== 0)) {
        const blank = itemList.querySelector('textarea');
        problem = ['Add at least one item with a description and a price.', blank];
      } else if (!inv.number.trim()) {
        problem = ['Give this invoice a number.', field('number')];
      }
      if (!problem) return true;
      setView('edit');
      toast(problem[0], 'error');
      problem[1].setAttribute('aria-invalid', 'true');
      problem[1].focus();
      return false;
    }

    function markSent() {
      const inv = ed.inv;
      inv.status = 'sent';
      inv.sentDate = today();
      inv.from = core.businessIdentity(Store.state.business);
      commit();
      refresh();
    }

    async function recordPayment() {
      if (!ensureReady()) return;
      const inv = ed.inv;
      const total = core.calcTotals(inv).total;
      const result = await showDialog(html`<form class="dialog-body">
        <h2 class="dialog-title">Record payment</h2>
        <p class="dialog-text">${inv.number} · <strong>${money(total)}</strong> from ${inv.billTo.name}</p>
        <div class="grid grid-2">
          <label class="field">
            <span class="field-label">Date received</span>
            <input type="date" id="pay-date" name="paidDate" value="${today()}" required>
          </label>
          <label class="field">
            <span class="field-label">Payment method</span>
            <select id="pay-method" name="method">${PAYMENT_METHODS.map((m) => html`<option>${m}</option>`)}</select>
          </label>
        </div>
        <div class="dialog-actions">
          <button type="button" class="btn" data-close>Cancel</button>
          <button type="submit" class="btn btn-primary" autofocus>${icon('check')}Mark as paid</button>
        </div>
      </form>`, {
        onSubmit: (data) => {
          const date = String(data.get('paidDate'));
          if (!core.isISODate(date)) {
            toast('Choose the date the payment arrived.', 'error');
            return false;
          }
          return { date, method: String(data.get('method')) };
        },
      });
      if (!result) return;
      inv.status = 'paid';
      inv.paidDate = result.date;
      inv.paymentMethod = result.method;
      if (!inv.sentDate) inv.sentDate = inv.issueDate;
      if (!inv.from) inv.from = core.businessIdentity(Store.state.business);
      commit();
      refresh();
      toast(`${inv.number} is marked as paid`);
    }

    async function email() {
      if (!ensureReady()) return;
      commit();
      const inv = ed.inv;
      const status = core.displayStatus(inv, today());
      const draft = Doc.emailDraft(inv, Store.state.business, docOptions());
      const title = { overdue: 'Send a payment reminder', paid: 'Send a receipt' }[status] || 'Email this invoice';
      let markedSent = false;

      await showDialog(html`<form class="dialog-body">
        <h2 class="dialog-title">${title}</h2>
        <label class="field">
          <span class="field-label">To</span>
          <input type="email" id="mail-to" name="to" value="${inv.billTo.email}" placeholder="client@example.com">
        </label>
        <label class="field">
          <span class="field-label">Subject</span>
          <input id="mail-subject" name="subject" value="${draft.subject}">
        </label>
        <label class="field">
          <span class="field-label">Message</span>
          <textarea id="mail-body" name="body" rows="10">${draft.body}</textarea>
        </label>
        <div class="callout">${icon('info')}<p>Attach the invoice as a PDF: choose <strong>Print / PDF</strong>, then “Save as PDF”. Email apps can’t attach it for you.</p></div>
        ${inv.status === 'draft' ? html`<label class="check"><input type="checkbox" id="mail-mark-sent" name="markSent" checked> Mark this invoice as sent</label>` : ''}
        <div class="dialog-actions">
          <button type="button" class="btn spacer" data-close>Close</button>
          <button type="button" class="btn" data-copy>${icon('copy')}Copy message</button>
          <a class="btn btn-primary" data-mailto href="mailto:">${icon('mail')}Open in email app</a>
        </div>
      </form>`, {
        wide: true,
        setup: (form, settle) => {
          const mailto = form.querySelector('[data-mailto]');
          const text = (name) => form.elements.namedItem(name).value;
          const updateLink = () => {
            const to = encodeURIComponent(text('to').trim()).replace(/%40/g, '@');
            const body = text('body').replace(/\r?\n/g, '\r\n');
            mailto.href = `mailto:${to}?subject=${encodeURIComponent(text('subject'))}&body=${encodeURIComponent(body)}`;
          };
          const markIfChecked = () => {
            const box = form.elements.namedItem('markSent');
            if (box && box.checked && ed.inv.status === 'draft') {
              markSent();
              markedSent = true;
            }
          };
          updateLink();
          form.addEventListener('input', updateLink);
          mailto.addEventListener('click', () => {
            markIfChecked();
            setTimeout(() => settle(true), 0);
          });
          form.querySelector('[data-copy]').addEventListener('click', () => {
            const message = `Subject: ${text('subject')}\n\n${text('body')}`;
            markIfChecked();
            const fallback = () => {
              const area = form.elements.namedItem('body');
              area.focus();
              area.select();
              toast('Message selected. Press Ctrl+C (or ⌘C) to copy it.');
            };
            try {
              navigator.clipboard.writeText(message).then(() => toast('Message copied. Paste it into your email.'), fallback);
            } catch (err) {
              fallback();
            }
          });
        },
      });
      if (markedSent) toast(`${inv.number} is marked as sent`);
    }

    function print() {
      commit();
      printInvoice(ed.inv);
    }

    async function voidInvoice() {
      const ok = await confirmAction({
        title: `Void ${ed.inv.number}?`,
        message: 'Use this when an invoice was sent by mistake or has been cancelled. It stays in your records, marked void, and stops counting as money owed.',
        confirmLabel: 'Void invoice',
        danger: true,
      });
      if (!ok) return;
      ed.inv.status = 'void';
      commit();
      refresh();
    }

    function restore() {
      ed.inv.status = ed.inv.sentDate ? 'sent' : 'draft';
      commit();
      refresh();
    }

    function markUnpaid() {
      Object.assign(ed.inv, { status: 'sent', paidDate: null, paymentMethod: '' });
      commit();
      refresh();
    }

    function revertToDraft() {
      Object.assign(ed.inv, { status: 'draft', sentDate: null, from: null });
      commit();
      refresh();
      toast(`${ed.inv.number} moved back to drafts`);
    }

    function duplicate() {
      commit();
      const s = Store.state;
      const copy = core.duplicateInvoice(ed.inv, s.business, s.invoices, today());
      Store.putInvoice(copy);
      toast(`Created ${copy.number}, a copy of ${ed.inv.number}`);
      go(`#/invoices/${copy.id}`);
    }

    async function remove() {
      const inv = ed.inv;
      const ok = await confirmAction({
        title: `Delete ${inv.number || 'this invoice'}?`,
        message: inv.status === 'draft'
          ? 'This draft will be deleted for good.'
          : 'This invoice has already gone to a client. Deleting it removes it from your records for good. To keep a record, void it instead.',
        confirmLabel: 'Delete invoice',
        danger: true,
      });
      if (!ok) return;
      clearTimeout(ed.timer);
      ed.dirty = false;
      if (ed.persisted) Store.deleteInvoice(inv.id);
      pendingDraft = null;
      toast(`${inv.number || 'Invoice'} deleted`);
      go('#/');
    }

    const actions = {
      'add-item': addItem,
      'mark-sent': () => {
        if (!ensureReady()) return;
        markSent();
        toast(`${ed.inv.number} is marked as sent`);
      },
      'record-payment': recordPayment,
      'mark-unpaid': markUnpaid,
      'revert-draft': revertToDraft,
      void: voidInvoice,
      restore,
      duplicate,
      delete: remove,
      email,
      print,
    };

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action === 'remove-item') {
        removeItem(btn.closest('.item-row'));
        return;
      }
      const run = actions[btn.dataset.action];
      if (!run) return;
      e.preventDefault();
      closeMenus();
      run();
    });

    // ---- Edit / preview switch (narrow screens) ----

    function setView(view) {
      root.dataset.view = view;
      root.querySelectorAll('.view-switch [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
      if (view === 'preview') fitPaper(stage);
      else root.querySelectorAll('textarea[data-grow]').forEach(autoGrow);
    }

    root.querySelector('.view-switch').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (btn) setView(btn.dataset.view);
    });

    // ---- Start ----

    renderItems();
    renderClientOptions();
    renderChrome();
    renderSaveState(ed.persisted ? 'saved' : 'new');
    checkNumber();
    renderTotals();
    renderPreview();
    const unwatch = watchPaper(stage);
    flushEdits = save;
    leaveView = () => {
      save();
      unwatch();
      preparePrint('');
      flushEdits = null;
    };

    if (!ed.persisted) {
      const first = ed.inv.billTo.name ? itemList.querySelector('textarea') : field('billTo.name');
      first.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Clients
  // ---------------------------------------------------------------------------

  function viewClients() {
    const { clients, invoices, business } = Store.state;
    const t = today();
    const stats = new Map(clients.map((c) => [c.id, { count: 0, owed: {}, last: '' }]));
    for (const inv of invoices) {
      const s = stats.get(inv.clientId);
      if (!s) continue;
      s.count += 1;
      if (inv.issueDate > s.last) s.last = inv.issueDate;
      const status = core.displayStatus(inv, t);
      if (status === 'sent' || status === 'overdue') {
        s.owed[inv.currency] = (s.owed[inv.currency] || 0) + core.calcTotals(inv).balanceDue;
      }
    }
    const sorted = [...clients].sort((a, b) => a.name.localeCompare(b.name));

    main.innerHTML = String(html`<div class="page">
      ${notices()}
      <header class="page-head">
        <div>
          <h1 class="page-title">Clients</h1>
          <p class="page-sub">People and companies you bill. New clients are saved automatically when you invoice them.</p>
        </div>
        <button type="button" class="btn btn-primary" data-action="add-client">${icon('plus')}<span>Add client</span></button>
      </header>
      <section class="panel">
        ${sorted.length ? html`<div class="table-wrap"><table class="table client-table">
          <thead><tr>
            <th scope="col">Client</th><th scope="col">Email</th><th scope="col" class="num">Invoices</th>
            <th scope="col">Last invoice</th><th scope="col" class="num">Owed to you</th><th scope="col"><span class="sr-only">Actions</span></th>
          </tr></thead>
          <tbody>${sorted.map((c) => {
            const s = stats.get(c.id);
            const owed = Object.keys(s.owed).length ? amountsList(s.owed, business.currency).join(' + ') : '—';
            return html`<tr data-client="${c.id}">
              <td class="c-client"><button type="button" class="row-link" data-action="edit-client" data-id="${c.id}">${c.name}</button>${c.contact ? html`<span class="cell-sub">${c.contact}</span>` : ''}</td>
              <td class="c-email">${c.email || html`<span class="muted">—</span>`}</td>
              <td class="c-count num">${s.count}</td>
              <td class="c-last">${s.last ? fmtDate(s.last) : html`<span class="muted">—</span>`}</td>
              <td class="c-owed num">${owed}</td>
              <td class="c-actions"><button type="button" class="btn btn-sm" data-action="client-invoice" data-id="${c.id}">${icon('plus')}Invoice</button></td>
            </tr>`;
          })}</tbody>
        </table></div>` : html`<div class="empty">
          <p class="empty-title">No clients yet.</p>
          <p class="empty-text">Clients are added automatically the first time you invoice them. You can also add one now.</p>
        </div>`}
      </section>
    </div>`);

    main.querySelector('.page').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      const row = e.target.closest('tr[data-client]');
      if (btn && btn.dataset.action === 'add-client') editClient(null);
      else if (btn && btn.dataset.action === 'client-invoice') startInvoiceFor(Store.getClient(btn.dataset.id));
      else if (btn && btn.dataset.action === 'edit-client') editClient(Store.getClient(btn.dataset.id));
      else if (row && !btn) editClient(Store.getClient(row.dataset.client));
    });
  }

  async function editClient(client) {
    const isNew = !client;
    const c = client || { name: '', contact: '', email: '', phone: '', address: '' };
    const result = await showDialog(html`<form class="dialog-body" novalidate>
      <h2 class="dialog-title">${isNew ? 'Add client' : c.name}</h2>
      <label class="field">
        <span class="field-label">Client or company name</span>
        <input id="client-name" name="name" value="${c.name}" autocomplete="off"${attr(isNew, 'autofocus')}>
      </label>
      <div class="grid grid-2">
        <label class="field">
          <span class="field-label">Contact person <span class="optional">optional</span></span>
          <input id="client-contact" name="contact" value="${c.contact}" autocomplete="off">
        </label>
        <label class="field">
          <span class="field-label">Phone <span class="optional">optional</span></span>
          <input id="client-phone" name="phone" type="tel" value="${c.phone}" autocomplete="off">
        </label>
      </div>
      <label class="field">
        <span class="field-label">Email</span>
        <input id="client-email" name="email" type="email" value="${c.email}" autocomplete="off">
      </label>
      <label class="field">
        <span class="field-label">Billing address</span>
        <textarea id="client-address" name="address" rows="3">${c.address}</textarea>
      </label>
      <p class="field-error" id="client-error" hidden></p>
      <div class="dialog-actions">
        ${isNew ? '' : html`<button type="button" class="btn btn-ghost btn-danger-text spacer" data-delete>${icon('trash')}Delete</button>`}
        <button type="button" class="btn" data-close>Cancel</button>
        <button type="submit" class="btn btn-primary"${attr(!isNew, 'autofocus')}>${isNew ? 'Add client' : 'Save changes'}</button>
      </div>
    </form>`, {
      onSubmit: (data, form) => {
        const name = String(data.get('name')).trim();
        const error = form.querySelector('#client-error');
        const clash = Store.findClientByName(name);
        if (!name || (clash && clash.id !== c.id)) {
          error.textContent = name ? `You already have a client called ${clash.name}.` : 'Enter the client’s name.';
          error.hidden = false;
          form.elements.namedItem('name').focus();
          return false;
        }
        const value = (key) => String(data.get(key)).trim();
        return { ...c, name, contact: value('contact'), email: value('email'), phone: value('phone'), address: value('address') };
      },
      setup: (form, settle) => {
        const del = form.querySelector('[data-delete]');
        if (del) del.addEventListener('click', () => settle('delete'));
      },
    });

    if (result === 'delete') {
      const count = Store.state.invoices.filter((inv) => inv.clientId === c.id).length;
      const ok = await confirmAction({
        title: `Delete ${c.name}?`,
        message: count
          ? `Their ${count} ${plural(count, 'invoice')} will stay in your records with the details already printed on them.`
          : 'This removes them from your client list.',
        confirmLabel: 'Delete client',
        danger: true,
      });
      if (!ok) return;
      Store.deleteClient(c.id);
      toast(`${c.name} deleted`);
      viewClients();
    } else if (result) {
      Store.putClient(result);
      toast(isNew ? `${result.name} added` : 'Client saved');
      viewClients();
    }
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  function viewSettings() {
    const b = Store.state.business;
    const lastBackup = Store.state.lastBackupAt;
    main.innerHTML = String(html`<div class="page page--wide">
      ${notices()}
      <header class="page-head">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-sub">These details appear on your invoices. Changes save automatically.</p>
        </div>
        <span class="save-state" id="settings-save" aria-live="polite"></span>
      </header>

      <div class="settings-grid">
        <form id="settings-form" class="settings-form" novalidate>
          <section class="card form-section" aria-labelledby="h-business">
            <h2 class="section-title" id="h-business">Business details</h2>
            <div class="field">
              <span class="field-label">Logo</span>
              <div class="logo-field" id="logo-field"></div>
              <input type="file" id="logo-input" class="sr-only" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" tabindex="-1">
            </div>
            <div class="grid grid-2">
              <label class="field span-2">
                <span class="field-label">Business name</span>
                <input id="set-name" name="name" value="${b.name}" autocomplete="organization">
              </label>
              <label class="field">
                <span class="field-label">Email</span>
                <input id="set-email" name="email" type="email" value="${b.email}" autocomplete="email">
              </label>
              <label class="field">
                <span class="field-label">Phone</span>
                <input id="set-phone" name="phone" type="tel" value="${b.phone}" autocomplete="tel">
              </label>
              <label class="field span-2">
                <span class="field-label">Address</span>
                <textarea id="set-address" name="address" rows="3" autocomplete="street-address">${b.address}</textarea>
              </label>
              <label class="field">
                <span class="field-label">Website <span class="optional">optional</span></span>
                <input id="set-website" name="website" value="${b.website}" placeholder="yourbusiness.com" autocomplete="url">
              </label>
              <label class="field">
                <span class="field-label">Tax or registration number <span class="optional">optional</span></span>
                <input id="set-tax-id" name="taxId" value="${b.taxId}" placeholder="e.g. VAT GB123456789 or EIN 12-3456789">
              </label>
            </div>
          </section>

          <section class="card form-section" aria-labelledby="h-brand">
            <h2 class="section-title" id="h-brand">Brand color</h2>
            <div class="swatches" role="group" aria-label="Brand color">
              ${BRAND_SWATCHES.map((color) => html`<button type="button" class="swatch" data-color="${color}" style="--swatch: ${color}" aria-label="Use ${color}" aria-pressed="${b.brandColor.toLowerCase() === color.toLowerCase()}"></button>`)}
              <label class="swatch-custom">
                <input type="color" id="set-brand" name="brandColor" value="${b.brandColor}">
                <span>Custom</span>
              </label>
            </div>
            <p class="hint">Used for the invoice title, amount due and table rules. Very light colors are darkened so they stay readable on paper.</p>
          </section>

          <section class="card form-section" aria-labelledby="h-defaults">
            <h2 class="section-title" id="h-defaults">Invoice defaults <small>for new invoices</small></h2>
            <div class="grid grid-2">
              <label class="field">
                <span class="field-label">Currency</span>
                <select id="set-currency" name="currency">${currencyOptions(b.currency)}</select>
              </label>
              <label class="field">
                <span class="field-label">Payment terms</span>
                <select id="set-terms" name="termsDays">${termsOptions(b.termsDays, { allowCustom: false })}</select>
              </label>
              <label class="field">
                <span class="field-label">Number prefix</span>
                <input id="set-prefix" name="invoicePrefix" class="mono" value="${b.invoicePrefix}" placeholder="INV-">
              </label>
              <label class="field">
                <span class="field-label">Next number</span>
                <input id="set-next" name="nextNumber" inputmode="numeric" value="${b.nextNumber}">
                <span class="hint" id="next-number-hint"></span>
              </label>
              <label class="field">
                <span class="field-label">Tax name</span>
                <input id="set-tax-label" name="taxLabel" value="${b.taxLabel}" placeholder="Tax, VAT, GST, Sales tax">
              </label>
              <label class="field">
                <span class="field-label">Tax rate (%)</span>
                <input id="set-tax-rate" name="taxRate" inputmode="decimal" value="${b.taxRate ? core.formatDecimal(b.taxRate, locale) : ''}" placeholder="0">
              </label>
              <label class="field span-2">
                <span class="field-label">How clients can pay you</span>
                <textarea id="set-payment" name="paymentInstructions" rows="3" placeholder="e.g. Bank transfer to Account 12345678, sort code 00-00-00. Or pay by card at yourbusiness.com/pay">${b.paymentInstructions}</textarea>
              </label>
              <label class="field span-2">
                <span class="field-label">Note at the bottom of invoices</span>
                <textarea id="set-notes" name="notes" rows="2">${b.notes}</textarea>
              </label>
            </div>
          </section>

          <section class="card form-section" aria-labelledby="h-data">
            <h2 class="section-title" id="h-data">Your data</h2>
            <p class="section-text">Invoicer keeps everything in this browser on this device. Nothing is uploaded anywhere. Download a backup regularly; you can also use it to move to another computer.</p>
            <p class="hint">${lastBackup ? `Last backup: ${fmtDate(lastBackup.slice(0, 10))}` : 'You haven’t downloaded a backup yet.'}</p>
            <div class="button-row">
              <button type="button" class="btn" data-action="backup-now">${icon('download')}Download backup</button>
              <button type="button" class="btn" data-action="restore-backup">${icon('upload')}Restore from backup</button>
              <button type="button" class="btn" data-action="export-csv">${icon('download')}Export invoices (CSV)</button>
              <input type="file" id="restore-input" class="sr-only" accept="application/json,.json" tabindex="-1">
            </div>
            <div class="danger-zone">
              <div>
                <p class="danger-title">Erase everything</p>
                <p class="hint">Deletes all invoices, clients and settings from this browser.</p>
              </div>
              <button type="button" class="btn btn-danger-outline" data-action="erase-all">${icon('trash')}Erase all data</button>
            </div>
          </section>
        </form>

        <aside class="settings-preview" aria-label="Invoice preview">
          <div class="preview-caption"><span>Preview</span><span id="settings-preview-note"></span></div>
          <div class="paper-stage" id="settings-paper"><div class="paper-scale"></div></div>
        </aside>
      </div>
    </div>`);

    const page = main.querySelector('.page');
    const form = main.querySelector('#settings-form');
    const stage = main.querySelector('#settings-paper');
    const logoInput = main.querySelector('#logo-input');
    const restoreInput = main.querySelector('#restore-input');
    let saveTimer = 0;

    // Preview with the most recent invoice (or an example), always using current settings.
    const latest = [...Store.state.invoices].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))[0];
    const previewSource = latest || Store.sampleData(today()).invoices.find((inv) => inv.number === 'INV-0004');
    main.querySelector('#settings-preview-note').textContent = latest ? `Using ${latest.number}` : 'Using example items';

    function paint() {
      const inv = { ...previewSource, from: null };
      if (!latest) {
        inv.number = core.nextInvoiceNumber(b, Store.state.invoices);
        inv.status = 'draft';
        inv.paymentInstructions = b.paymentInstructions;
        inv.notes = b.notes;
        inv.currency = b.currency;
        inv.items = previewSource.items.map((item) => ({ ...item, unitPrice: core.rescaleAmount(item.unitPrice, 'USD', b.currency) }));
      }
      mountPaper(stage, String(Doc.renderInvoice(inv, b, docOptions())));
      main.querySelector('#next-number-hint').textContent = `Next invoice: ${core.nextInvoiceNumber(b, Store.state.invoices)}`;
    }

    function renderLogo() {
      main.querySelector('#logo-field').innerHTML = String(html`
        <div class="logo-box">${b.logo ? html`<img src="${b.logo}" alt="Your logo">` : html`<span class="muted">No logo</span>`}</div>
        <div class="logo-actions">
          <button type="button" class="btn btn-sm" data-action="pick-logo">${icon('upload')}${b.logo ? 'Replace logo' : 'Upload logo'}</button>
          ${b.logo ? html`<button type="button" class="btn btn-sm btn-ghost" data-action="remove-logo">Remove</button>` : ''}
          <p class="hint">PNG, JPG or SVG. A transparent or white background looks best.</p>
        </div>`);
    }

    function markSaving() {
      const indicator = main.querySelector('#settings-save');
      indicator.textContent = 'Saving…';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 400);
    }

    function save() {
      clearTimeout(saveTimer);
      const ok = Store.save();
      const indicator = main.querySelector('#settings-save');
      if (indicator) indicator.innerHTML = String(ok ? html`${icon('check')}Saved` : html`Not saved`);
      return ok;
    }

    function setBrand(color) {
      b.brandColor = color;
      form.elements.namedItem('brandColor').value = color;
      main.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.color.toLowerCase() === color.toLowerCase())));
      markSaving();
      paint();
    }

    form.addEventListener('submit', (e) => e.preventDefault());

    form.addEventListener('input', (e) => {
      const el = e.target;
      if (!el.name || el.type === 'file') return;
      if (el.name === 'nextNumber') b.nextNumber = Math.max(1, parseInt(el.value, 10) || 1);
      else if (el.name === 'taxRate') b.taxRate = Math.max(0, core.parseDecimal(el.value, decimalSep));
      else if (el.name === 'termsDays') b.termsDays = Number(el.value);
      else if (el.name === 'brandColor') {
        setBrand(el.value);
        return;
      } else b[el.name] = el.value;
      markSaving();
      paint();
    });

    form.addEventListener('change', (e) => {
      const el = e.target;
      if (el.name === 'nextNumber') el.value = b.nextNumber;
      if (el.name === 'taxRate') el.value = b.taxRate ? core.formatDecimal(b.taxRate, locale) : '';
    });

    page.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action], [data-color]');
      if (!btn) return;
      if (btn.dataset.color) {
        setBrand(btn.dataset.color);
        return;
      }
      switch (btn.dataset.action) {
        case 'pick-logo':
          logoInput.click();
          break;
        case 'remove-logo':
          b.logo = '';
          save();
          renderLogo();
          paint();
          break;
        case 'restore-backup':
          restoreInput.click();
          break;
        case 'export-csv':
          exportCSV();
          break;
        case 'erase-all': {
          const ok = await confirmAction({
            title: 'Erase all data?',
            message: 'Every invoice, client and setting will be deleted from this browser. This can’t be undone, so download a backup first if you might need them.',
            confirmLabel: 'Erase everything',
            danger: true,
          });
          if (!ok) return;
          Store.reset();
          toast('All data erased');
          go('#/');
          break;
        }
        default:
      }
    });

    logoInput.addEventListener('change', async () => {
      const file = logoInput.files[0];
      logoInput.value = '';
      if (!file) return;
      const previous = b.logo;
      try {
        b.logo = await prepareLogo(file);
      } catch (err) {
        toast(err.message, 'error');
        return;
      }
      if (!save()) {
        b.logo = previous;
        Store.save();
      }
      renderLogo();
      paint();
    });

    restoreInput.addEventListener('change', async () => {
      const file = restoreInput.files[0];
      restoreInput.value = '';
      if (!file) return;
      let parsed;
      try {
        parsed = Store.parseBackup(await file.text());
      } catch (err) {
        toast(err.message, 'error');
        return;
      }
      const { state: next, exportedAt } = parsed;
      const when = core.isISODate(exportedAt.slice(0, 10)) ? fmtDate(exportedAt.slice(0, 10)) : 'an unknown date';
      const ok = await confirmAction({
        title: 'Restore this backup?',
        message: `The backup from ${when} has ${next.invoices.length} ${plural(next.invoices.length, 'invoice')} and ${next.clients.length} ${plural(next.clients.length, 'client')}. It replaces everything Invoicer has in this browser now.`,
        confirmLabel: 'Replace and restore',
        danger: true,
      });
      if (!ok) return;
      Store.replaceAll(next);
      toast('Backup restored');
      go('#/');
    });

    renderLogo();
    paint();
    const unwatch = watchPaper(stage);
    flushEdits = save;
    leaveView = () => {
      if (saveTimer) save();
      unwatch();
      flushEdits = null;
    };
  }

  // ---------------------------------------------------------------------------
  // App-wide events and start-up
  // ---------------------------------------------------------------------------

  const globalActions = {
    'new-invoice': () => startNewInvoice(),
    'load-sample': () => {
      Store.loadSample(today());
      go('#/');
    },
    'clear-sample': async () => {
      const ok = await confirmAction({
        title: 'Start fresh?',
        message: 'This removes the sample business, clients and invoices so you can set up your own.',
        confirmLabel: 'Remove sample data',
      });
      if (!ok) return;
      Store.reset();
      go('#/');
    },
    'backup-now': downloadBackup,
    'backup-later': () => {
      Store.snoozeBackupReminder(core.addDays(today(), 14));
      rerender();
    },
  };

  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-action="toggle-menu"]');
    if (toggle) {
      const list = toggle.nextElementSibling;
      const open = list.hidden;
      closeMenus(list);
      list.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) list.querySelector('.menu-item').focus();
      return;
    }
    if (!e.target.closest('.menu-list')) closeMenus();

    const btn = e.target.closest('[data-action]');
    if (btn && globalActions[btn.dataset.action]) {
      e.preventDefault();
      globalActions[btn.dataset.action](btn);
      return;
    }
    const row = e.target.closest('tr[data-href]');
    if (row && !e.target.closest('a, button')) go(row.dataset.href);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenus();
  });

  // Save anything still pending when the tab is hidden or closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && flushEdits) flushEdits();
  });
  window.addEventListener('pagehide', () => flushEdits && flushEdits());

  // Another tab changed the data: reload it and redraw this screen.
  window.addEventListener('storage', (e) => {
    if (e.key !== Store.KEY) return;
    Store.load();
    render();
  });

  document.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', String(icon(el.dataset.icon))));

  Store.onError = (message) => toast(message, 'error');
  Store.load();
  if (DEMO && !Store.state.business.name && !Store.state.invoices.length) Store.loadSample(today());
  currentRoute = location.hash || '#/';
  render();
})();
