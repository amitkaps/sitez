// Wires the button @fold-out.html.js wrote: it shows and hides the text beside it.
export default class extends HTMLElement {
  connectedCallback() {
    const button = this.querySelector("button");
    const text = this.querySelector("div");
    button.onclick = () => {
      text.hidden = !text.hidden;
      button.setAttribute("aria-expanded", String(!text.hidden));
    };
  }
}
