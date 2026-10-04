import { html } from "sitez";

export default ({ type = "note", children }) =>
  html`<aside class="call-out ${type}">${children}</aside>`;
