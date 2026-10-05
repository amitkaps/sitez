import box from "./@tag-box.html.js";

export default class extends HTMLElement {
  connectedCallback() {
    this.dataset.box = String(box);
  }
}
