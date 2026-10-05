export const label = "Go";

export default class extends HTMLElement {
  connectedCallback() {
    this.textContent = label;
  }
}
