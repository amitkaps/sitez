/** @prose
 * # `sitez` in the browser
 *
 * What an island imports: htl's `html`, which makes DOM nodes, a signals core, and `define`,
 * which upgrades every `<name>` on the page, and any added later, once each.
 */
export { html } from "htl";
export { signal, effect, computed } from "@preact/signals-core";

export function define(name, setup) {
  customElements.define(
    name,
    class extends HTMLElement {
      connectedCallback() {
        if (this.ready) return;
        this.ready = true;
        setup(this);
      }
    },
  );
}
