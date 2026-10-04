import { html } from "sitez";
import plans from "../data/plans.json";
import Plan from "./_plan.js";

export default ({ site }) => html`
  <h1>${site.name}</h1>

  <p>A small tool that does one thing well.</p>

  <details>
    <summary>How much does it cost?</summary>
    <ul>
      ${plans.map((plan) => Plan({ plan }))}
    </ul>
  </details>

  <p><a href="/lantern.txt">Download</a></p>
`;
