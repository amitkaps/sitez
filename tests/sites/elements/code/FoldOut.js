// Writes what the fold-out island will wire. The text inside it stays HTML.
import { html } from "sitez";

export default ({ label = "More", page, children }) => html`
  <fold-out>
    <button aria-expanded="false" title="${label} on ${page.title}">${label}</button>
    <div hidden>${children}</div>
  </fold-out>
`;
