/*
 * The invoice as a client sees it: the printable page and the email that goes with it.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'), require('./html.js'));
  } else {
    root.InvoiceDocument = factory(root.InvoiceCore, root.Html);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core, H) {
  'use strict';

  const { html } = H;

  // Business details for this invoice: the snapshot taken when it was sent, else Settings.
  function senderOf(inv, business) {
    return inv.from ? { ...core.businessIdentity(business), ...inv.from } : core.businessIdentity(business);
  }

  const placeholder = (text) => html`<span class="doc-placeholder">${text}</span>`;

  function hasContent(item) {
    return Boolean(String(item.description || '').trim()) || core.lineAmount(item) !== 0;
  }

  function trimNumber(n, locale) {
    return core.formatDecimal(n, locale, { min: 0, max: 4 });
  }

  function renderInvoice(inv, business, { locale, today }) {
    const from = senderOf(inv, business);
    const t = core.calcTotals(inv);
    const status = core.displayStatus(inv, today);
    const money = (minor) => core.formatMoney(minor, inv.currency, locale);
    const date = (iso) => core.formatDate(iso, locale);
    const brand = core.readableOnWhite(business.brandColor);
    const items = inv.items.filter(hasContent);
    const client = inv.billTo;
    const terms = core.termsLabel(inv.termsDays);
    const discountLabel = inv.discountType === 'percent' && inv.discountValue
      ? `Discount (${trimNumber(inv.discountValue, locale)}%)`
      : 'Discount';
    const taxLabel = `${inv.taxLabel || 'Tax'} (${trimNumber(inv.taxRate, locale)}%)`;

    const dueBox = status === 'paid'
      ? html`<div class="doc-label">Amount paid</div>
          <div class="doc-due-amount">${money(t.total)}</div>
          <div class="doc-due-note">Paid ${date(inv.paidDate)}</div>`
      : html`<div class="doc-label">Amount due</div>
          <div class="doc-due-amount">${money(t.balanceDue)}</div>
          <div class="doc-due-note">${inv.termsDays === 0 ? 'Due on receipt' : `Due ${date(inv.dueDate)}`}</div>`;

    return html`<article class="doc" style="--brand: ${brand}" lang="${locale}">
  <header class="doc-head">
    <div class="doc-brand">
      ${business.logo ? html`<img class="doc-logo" src="${business.logo}" alt="">` : ''}
      <div class="doc-biz">${from.name || placeholder('Your business name')}</div>
      <p class="doc-lines">${[
        from.address,
        [from.email, from.phone].filter(Boolean).join('  ·  '),
        from.website,
        from.taxId,
      ].filter(Boolean).join('\n')}</p>
    </div>
    <div class="doc-title">
      <h1>${status === 'void' ? 'Void invoice' : 'Invoice'}</h1>
      <div class="doc-number">${inv.number}</div>
      ${status === 'paid' ? html`<div class="doc-stamp doc-stamp--paid">Paid</div>` : ''}
      ${status === 'void' ? html`<div class="doc-stamp doc-stamp--void">Void</div>` : ''}
    </div>
  </header>

  <section class="doc-parties">
    <div class="doc-block">
      <div class="doc-label">Bill to</div>
      <p class="doc-strong">${client.name || placeholder('Client name')}</p>
      ${client.contact ? html`<p>Attn: ${client.contact}</p>` : ''}
      ${client.address ? html`<p>${client.address}</p>` : ''}
      ${client.email ? html`<p>${client.email}</p>` : ''}
    </div>
    <dl class="doc-meta">
      <dt>Issue date</dt><dd>${date(inv.issueDate)}</dd>
      <dt>Due date</dt><dd>${date(inv.dueDate)}</dd>
      ${terms ? html`<dt>Terms</dt><dd>${terms}</dd>` : ''}
      ${inv.reference ? html`<dt>Reference</dt><dd>${inv.reference}</dd>` : ''}
    </dl>
    <div class="doc-due">${dueBox}</div>
  </section>

  <table class="doc-items">
    <colgroup><col><col class="doc-col-qty"><col class="doc-col-rate"><col class="doc-col-amount"></colgroup>
    <thead>
      <tr><th>Description</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr>
    </thead>
    <tbody>
      ${items.length
        ? items.map((item) => html`<tr>
            <td class="doc-desc">${item.description}</td>
            <td class="n">${trimNumber(item.quantity, locale)}</td>
            <td class="n">${money(item.unitPrice)}</td>
            <td class="n">${money(core.lineAmount(item))}</td>
          </tr>`)
        : html`<tr><td colspan="4">${placeholder('Your items will appear here')}</td></tr>`}
    </tbody>
  </table>

  <dl class="doc-totals">
    <dt>Subtotal</dt><dd>${money(t.subtotal)}</dd>
    ${t.discount ? html`<dt>${discountLabel}</dt><dd>−${money(t.discount)}</dd>` : ''}
    ${Number(inv.taxRate) ? html`<dt>${taxLabel}</dt><dd>${money(t.tax)}</dd>` : ''}
    <dt class="doc-grand">Total ${inv.currency}</dt><dd class="doc-grand">${money(t.total)}</dd>
    ${status === 'paid' ? html`
      <dt>Paid ${date(inv.paidDate)}${inv.paymentMethod ? ` · ${inv.paymentMethod}` : ''}</dt><dd>−${money(t.amountPaid)}</dd>
      <dt class="doc-grand">Balance due</dt><dd class="doc-grand">${money(t.balanceDue)}</dd>` : ''}
  </dl>

  ${inv.paymentInstructions || inv.notes ? html`<section class="doc-notes">
    ${inv.paymentInstructions ? html`<div><div class="doc-label">How to pay</div><p>${inv.paymentInstructions}</p></div>` : ''}
    ${inv.notes ? html`<div><div class="doc-label">Notes</div><p>${inv.notes}</p></div>` : ''}
  </section>` : ''}

  <footer class="doc-foot">
    <span>${from.name}</span>
    <span>${inv.number}${inv.dueDate && status !== 'paid' && status !== 'void' ? ` · Due ${date(inv.dueDate)}` : ''}</span>
  </footer>
</article>`;
  }

  // Subject and message for emailing an invoice, a payment reminder or a receipt.
  function emailDraft(inv, business, { locale, today }) {
    const from = senderOf(inv, business);
    const t = core.calcTotals(inv);
    const status = core.displayStatus(inv, today);
    const money = (minor) => core.formatMoney(minor, inv.currency, locale);
    const date = (iso) => core.formatDate(iso, locale, 'long');
    const greeting = `Hi ${inv.billTo.contact || inv.billTo.name || 'there'},`;
    const signOff = ['Thank you,', from.name].filter(Boolean).join('\n');
    const howToPay = inv.paymentInstructions ? `How to pay:\n${inv.paymentInstructions}` : '';

    let subject;
    let lines;
    if (status === 'paid') {
      subject = `Receipt for invoice ${inv.number}`;
      lines = [
        `Thank you for your payment of ${money(t.total)} for invoice ${inv.number}, received ${date(inv.paidDate)}.`,
        'A copy of the paid invoice is attached for your records.',
      ];
    } else if (status === 'overdue') {
      const late = core.daysBetween(inv.dueDate, today);
      subject = `Reminder: invoice ${inv.number} is past due`;
      lines = [
        `This is a friendly reminder that invoice ${inv.number} for ${money(t.balanceDue)} was due on ${date(inv.dueDate)} (${late} ${late === 1 ? 'day' : 'days'} ago).`,
        'If you have already sent payment, thank you, and please disregard this note. The invoice is attached again for convenience.',
        howToPay,
      ];
    } else {
      const due = inv.termsDays === 0 ? 'due on receipt' : `due by ${date(inv.dueDate)}`;
      subject = `Invoice ${inv.number} from ${from.name || 'us'}`;
      lines = [
        `Please find attached invoice ${inv.number} for ${money(t.balanceDue)}, ${due}.`,
        howToPay,
        'Let me know if you have any questions.',
      ];
    }
    const body = [greeting, ...lines.filter(Boolean), signOff].join('\n\n');
    return { subject, body };
  }

  return { renderInvoice, emailDraft, senderOf };
});
