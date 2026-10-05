/** @prose
 * # `sitez`
 *
 * What an element's markup file or a module imports at build time. `html` records a template for
 * the build's renderer. It is the package's one name. A `.browser.js` file imports nothing from
 * here, since it works on the page's DOM (rule 6), and the build fails one that tries.
 */
export { html, type Template } from "./html.ts";
