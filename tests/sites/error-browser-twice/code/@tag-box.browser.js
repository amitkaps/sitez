export default class extends HTMLElement {
  connectedCallback() {
    this.dataset.ready = "";
  }
}
