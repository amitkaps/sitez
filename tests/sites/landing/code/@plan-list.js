import { html } from "sitez";
import plan from "./plan.js";

export default ({ data }) => html`
  <details>
    <summary>How much does it cost?</summary>
    <ul>
      ${data.map(plan)}
    </ul>
  </details>
`;
