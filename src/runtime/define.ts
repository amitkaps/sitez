/** @prose
 * # Defining a live element
 *
 * What a page's script calls for each live element it uses, with the tag from the file's name and
 * the file's default export. A site never imports this. It's Sitez's, so the file name is the
 * only place an element is named (rule 6).
 *
 * `setup` runs once per element, on its first connect. The browser calls `connectedCallback` again
 * whenever an element moves, and a second `setup` would bind everything twice.
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
