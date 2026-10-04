// Writes what fold-out's live file will wire. The text inside it stays HTML.
import { html } from "@amitkaps/sitez";

export default ({ label = "More", page, children }) => html`
  <button aria-expanded="false" title="${label} on ${page.title}">${label}</button>
  <div hidden>${children}</div>
`;
