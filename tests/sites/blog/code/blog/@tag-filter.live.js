// Wires the buttons and posts @tag-filter.js wrote: a click shows the posts with that tag.
export default class extends HTMLElement {
  connectedCallback() {
    for (const button of this.querySelectorAll("button")) {
      button.onclick = () => this.show(button.value);
    }
  }

  show(value) {
    for (const button of this.querySelectorAll("button")) {
      button.setAttribute("aria-pressed", String(button.value === value));
    }
    for (const post of this.querySelectorAll("[data-tags]")) {
      const tags = post.dataset.tags.split(" ");
      post.hidden = value !== "" && !tags.includes(value);
    }
  }
}
