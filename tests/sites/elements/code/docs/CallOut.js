import { html } from "sitez";

export default ({ type = "note", children }) =>
  html`<aside class="docs-call-out ${type}">${children}</aside>`;
