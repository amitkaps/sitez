// A module, by its plain name: imported by a component, never output.
import { html } from "sitez";

export default (plan) => html`<li>${plan.name}: ${plan.price}.</li>`;
