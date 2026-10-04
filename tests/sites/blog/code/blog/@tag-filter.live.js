// Wires the buttons and posts @tag-filter.js wrote: a click shows the posts with that tag.
import { define, effect, signal } from "@amitkaps/sitez";

define("tag-filter", (el) => {
  const active = signal("");
  const buttons = [...el.querySelectorAll("button")];
  for (const button of buttons) button.onclick = () => (active.value = button.value);
  effect(() => {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.value === active.value));
    }
    for (const post of el.querySelectorAll("[data-tags]")) {
      const tags = post.dataset.tags.split(" ");
      post.hidden = active.value !== "" && !tags.includes(active.value);
    }
  });
});
