// Reads data/cards.json, which the element's data attribute names. Sitez doesn't write it out.
import { html } from "sitez";

export default ({ data }) => html`
  <ul>
    ${data.map((card) => html`<li>${card.name}: ${card.about}</li>`)}
  </ul>
`;
