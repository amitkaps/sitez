import box from "./@tag-box.js";

export default class extends HTMLElement {
  connectedCallback() {
    this.dataset.box = String(box);
  }
}
