import { html } from "sitez";

let count = 0;

export default () => html`
  <h1>Counter</h1>
  <button onclick=${() => count++}>Add one</button>
`;
