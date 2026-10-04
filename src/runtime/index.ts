/** @prose
 * # `sitez` at build time
 *
 * What a page, layout or component imports. `html` records a template for the build's renderer.
 * `signal` and `effect` work, since a module shared with an island may import them. `define`
 * fails, since an island never runs at build time.
 *
 * The package's exports pick this file or `browser.ts` by the `browser` condition, so build code
 * and islands write the same import ([design.md](../../docs/design.md#the-runtime)).
 */
export { html, type Template } from "./html.ts";
export { effect, signal } from "@preact/signals-core";

/** Fails. An island's `define` runs only in the browser, from its `.island.js` file. */
export function define(name: string, _setup?: (el: HTMLElement) => void): never {
  throw new Error(
    `define("${name}") ran at build time. An island goes in code/${name}.island.js, which runs only in the browser.`,
  );
}
