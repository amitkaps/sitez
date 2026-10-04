/** @prose
 * # The template value
 *
 * `html`…`` in Node records its strings and values and renders nothing; `render.js` turns it
 * into an escaped string. The browser's `sitez` is htl's `html` instead (`browser.js`), so the
 * same tag makes DOM nodes there.
 */
//
// Values are branded with a registered symbol, not a class, because a site's code and the build
// can load this file as two module instances (Vite's runner and Node's loader), and `instanceof`
// fails across them.
const TEMPLATE = Symbol.for("sitez.template");
const RAW = Symbol.for("sitez.raw");

export function html(strings, ...values) {
  return { [TEMPLATE]: true, strings, values };
}

/** HTML that is already safe: Markz's output and a component's rendered children. */
export const raw = (value) => ({ [RAW]: true, value });

export const isTemplate = (value) => value?.[TEMPLATE] === true;
export const isRaw = (value) => value?.[RAW] === true;
