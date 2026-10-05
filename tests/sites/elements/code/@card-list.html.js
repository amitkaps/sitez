// Reads data/cards.json, which the element's data attribute names. It writes a key-word of its own,
// which renders like any other.
import { html } from "@amitkaps/sitez";

export default ({ data }) => html`
  <ul>
    ${data.map((card) => html`<li><key-word>${card.name}</key-word>: ${card.about}</li>`)}
  </ul>
`;
