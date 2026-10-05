// Wires the buttons and posts @tag-filter.js wrote: a click shows the posts with that tag.
export default (el) => {
  const buttons = [...el.querySelectorAll("button")];
  const show = (value) => {
    for (const button of buttons) {
      button.setAttribute("aria-pressed", String(button.value === value));
    }
    for (const post of el.querySelectorAll("[data-tags]")) {
      const tags = post.dataset.tags.split(" ");
      post.hidden = value !== "" && !tags.includes(value);
    }
  };
  for (const button of buttons) button.onclick = () => show(button.value);
};
