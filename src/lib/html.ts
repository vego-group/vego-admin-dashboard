/**
 * HTML built as a string — Leaflet popups, tooltips and `divIcon`s.
 *
 * Leaflet takes those as raw HTML, so React's escaping never sees them. A
 * driver, station or zone name comes from the API, and drivers can register
 * their own names through the app: interpolated as-is, a name such as
 * `<img src=x onerror=…>` runs script in the admin's session, where the bearer
 * token sits in localStorage.
 *
 * Build that markup with the {@link html} tag only. Every `${value}` in it is
 * escaped, so no field can be forgotten. The only exception is markup the tag
 * itself produced, or that this app wrote as a constant and marked with
 * {@link trustedHtml} (an SVG icon) — never anything that came from the API.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Text made safe for an HTML text node or a quoted attribute value. `null`/`undefined` → ''. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Markup that is already safe: produced by {@link html}, or written in this codebase. */
export class TrustedHtml {
  constructor(private readonly markup: string) {}

  toString(): string {
    return this.markup;
  }
}

/** Mark a constant written in this codebase (an inline SVG icon) as markup. Never pass API data. */
export function trustedHtml(markup: string): TrustedHtml {
  return new TrustedHtml(markup);
}

function interpolate(value: unknown): string {
  if (value instanceof TrustedHtml) return value.toString();
  if (Array.isArray(value)) return value.map(interpolate).join('');
  return escapeHtml(value);
}

/**
 * Tagged template that escapes every interpolated value.
 *
 * ```ts
 * html`<b>${driver.name}</b>`          // name escaped
 * html`<div>${icon}${html`<i>${x}</i>`}</div>`  // nested html`` and trustedHtml() pass through
 * ```
 *
 * Pass the result to Leaflet with `String(...)`. Skip a fragment with `''`,
 * not `false`, which would print "false".
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TrustedHtml {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += interpolate(values[i]) + strings[i + 1];
  }
  return new TrustedHtml(out);
}

/** A number for a CSS percentage (`width:${pct}%`): finite and within 0–100. */
export function clampPercent(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
}
