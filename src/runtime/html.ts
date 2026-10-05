/** @prose
 * # The template value
 *
 * What `html` makes. It records its strings and values and renders nothing, and `render.ts` turns
 * it into a string. `html` exists only at build time, and a `.browser.js` file that imports it fails.
 *
 * A value is marked with a registered symbol, not a class. The site's code loads `sitez` through
 * Vite's module runner, and the build loads it through Node. That makes two copies of this file,
 * and `instanceof` fails between them ([design.md](../../docs/design.md#the-runtime)).
 */
const TEMPLATE = Symbol.for("sitez.template");
const RAW = Symbol.for("sitez.raw");

/** A template `html` recorded at build time, not yet rendered. */
export interface Template {
  readonly [TEMPLATE]: true;
  readonly strings: readonly string[];
  readonly values: readonly unknown[];
}

/** HTML that goes into a page as it is. */
export interface Raw {
  readonly [RAW]: true;
  readonly value: string;
}

/** Records a template for the build's renderer, escaping nothing yet. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): Template {
  return { [TEMPLATE]: true, strings, values };
}

/** @prose
 * HTML that is already safe, which only Sitez makes. That's Markz's output, and the children an
 * element is given. A site has no way to write it, so every value it interpolates is
 * escaped.
 */
export function raw(value: string): Raw {
  return { [RAW]: true, value };
}

export const isTemplate = (value: unknown): value is Template =>
  (value as Template | null)?.[TEMPLATE] === true;

export const isRaw = (value: unknown): value is Raw => (value as Raw | null)?.[RAW] === true;
