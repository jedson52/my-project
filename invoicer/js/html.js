/*
 * Tiny HTML templating: html`<p>${value}</p>` escapes every value unless it is
 * already safe (another html`` result or raw()). Arrays are joined.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Html = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class SafeHTML {
    constructor(value) {
      this.value = value;
    }

    toString() {
      return this.value;
    }
  }

  const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
  }

  function toHTML(value) {
    if (value == null || value === false || value === true) return '';
    if (value instanceof SafeHTML) return value.value;
    if (Array.isArray(value)) return value.map(toHTML).join('');
    return esc(value);
  }

  function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i += 1) out += toHTML(values[i]) + strings[i + 1];
    return new SafeHTML(out);
  }

  const raw = (value) => new SafeHTML(String(value));

  return { html, raw, esc };
});
