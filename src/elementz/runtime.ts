/** @prose
 * # The runtime
 *
 * All of elementz that reaches the browser: `define`, which makes an element's `setup` a custom
 * element ([elementz.md](../../docs/elementz.md#behavior-in-the-browser)). Each connection gets a
 * fresh `AbortController`. A disconnect aborts its signal and calls the cleanup `setup` returned,
 * so a listener given the signal goes with the element. A reconnect runs `setup` again.
 *
 * The host writes `define` into its script as source (`String(define)`), so it refers to nothing
 * outside itself, and keeps its state in a closure rather than in private fields that a compiler
 * might rewrite with helpers.
 */

/** What an element's `<script>` default-exports. It may return a cleanup, or a promise of one. */
export type Setup = (element: HTMLElement, options: { signal: AbortSignal }) => unknown;

/** Defines `name` as a custom element that runs `setup` on each connection. */
export function define(name: string, setup: Setup): void {
  const connections = new WeakMap<HTMLElement, AbortController>();
  customElements.define(
    name,
    class extends HTMLElement {
      connectedCallback() {
        const controller = new AbortController();
        connections.set(this, controller);
        const { signal } = controller;
        void Promise.resolve(setup(this, { signal })).then((cleanup) => {
          if (typeof cleanup !== "function") return;
          if (signal.aborted) cleanup();
          else signal.addEventListener("abort", () => cleanup(), { once: true });
        });
      }

      disconnectedCallback() {
        connections.get(this)?.abort();
        connections.delete(this);
      }
    },
  );
}
