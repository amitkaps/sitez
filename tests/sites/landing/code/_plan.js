// A module, by its `_`: imported by the page, never a page itself.
import { html } from "sitez";

export default ({ plan }) => html`<li>${plan.name}: ${plan.price}.</li>`;
