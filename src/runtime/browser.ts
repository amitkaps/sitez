/** @prose
 * # `sitez` in the browser
 *
 * What a live element's file imports. `html` is htl's, which makes DOM nodes, and `signal` and
 * `effect` are the signals core's. Each bundle keeps only what it uses, so a live file that never
 * calls `html` ships no htl.
 */
export { html } from "htl";
export { effect, signal } from "@preact/signals-core";

/** @prose
 * Defines `<name>` and calls `setup` once for each element, on its first connect. The browser
 * calls `connectedCallback` again whenever an element moves, and a second `setup` would bind
 * everything twice.
 */
export function define(name: string, setup: (el: HTMLElement) => void): void {
  const ready = new WeakSet<HTMLElement>();
  customElements.define(
    name,
    class extends HTMLElement {
      connectedCallback() {
        if (ready.has(this)) return;
        ready.add(this);
        setup(this);
      }
    },
  );
}
