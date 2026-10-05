import { html } from "@amitkaps/sitez";

export default class extends HTMLElement {
  connectedCallback() {
    this.append(html`<button>Go</button>`);
  }
}
