import { define, effect, signal } from "sitez";

// Wires the buttons FilterGrid.js wrote: a click shows only the items whose
// data-filter names the button's value.
define("filter-grid", (el) => {
  const buttons = [...el.querySelectorAll("button[data-value]")];
  const items = [...el.querySelectorAll("[data-filter]")];
  const active = signal("");

  for (const b of buttons) b.onclick = () => (active.value = b.dataset.value);

  effect(() => {
    for (const b of buttons) b.classList.toggle("is-checked", b.dataset.value === active.value);
    for (const item of items) {
      item.hidden = !!active.value && !item.dataset.filter.split(" ").includes(active.value);
    }
  });
});
