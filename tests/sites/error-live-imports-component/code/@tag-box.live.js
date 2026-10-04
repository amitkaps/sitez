import { define } from "sitez";
import box from "./@tag-box.js";

define("tag-box", (el) => {
  el.dataset.box = String(box);
});
