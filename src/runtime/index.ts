/** @prose
 * # `sitez`
 *
 * What a page, layout, component or module imports at build time. `html` records a template for
 * the build's renderer. It is the package's one name. A live element's file imports nothing from
 * here, since it works on the page's DOM (rule 6), and the build fails one that tries.
 */
export { html, type Template } from "./html.ts";
