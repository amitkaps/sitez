import { html } from "sitez";

export default ({ title, children }) => html`
  ${title && html`<strong>${title}</strong>`} ${children}
`;
