import { html } from "sitez";

export default ({ type = "note", title, children }) => html`
  <aside class="call-out ${type}">
    ${title && html`<strong>${title}</strong>`} ${children}
  </aside>
`;
