/** @prose
 * # `sitez` in Node
 *
 * What build-time code imports. `html` makes template values; `signal` and `effect` work, since
 * a helper shared with an island may import them; `define` fails, since an island never runs at
 * build time. A package's `exports` picks this file or `browser.js` by the `browser` condition,
 * so a site writes one import either way.
 */
export { html, raw } from "./html.js";
export { signal, effect, computed } from "@preact/signals-core";

export function define(name) {
  throw new Error(
    `define("${name}") ran at build time. Islands go in *.island.js files, which run only in the browser.`,
  );
}
