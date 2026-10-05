// Wires the button @fold-out.js wrote: it shows and hides the text beside it.
export default (el) => {
  const button = el.querySelector("button");
  const text = el.querySelector("div");
  button.onclick = () => {
    text.hidden = !text.hidden;
    button.setAttribute("aria-expanded", String(!text.hidden));
  };
};
