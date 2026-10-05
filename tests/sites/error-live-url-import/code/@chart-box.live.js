import { label } from "./chart.js";

export default class extends HTMLElement {
  connectedCallback() {
    this.textContent = label(1);
  }
}
