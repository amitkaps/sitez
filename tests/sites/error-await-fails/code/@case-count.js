import { html } from "sitez";
import { cases } from "./cases.ts";

export default async () => {
  const rows = await cases();
  return html`<p>${rows.length} cases</p>`;
};
