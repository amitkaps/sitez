import { html } from "sitez";

// {@filter-grid filters="vis:Visualisation, ds:Data Science"} … {/filter-grid}
// The buttons are written at build time, so the island that upgrades the tag
// adds behavior without moving anything on the page.
export default ({ filters, children }) => {
  const pairs = [["", "Show all"], ...filters.split(",").map((pair) => pair.trim().split(":"))];
  return html`<filter-grid>
    <div class="button-group filters-button-group">
      ${pairs.map(([value, label]) => html`<button data-value=${value} class=${value ? null : "is-checked"}>${label}</button>`)}
    </div>
    ${children}
  </filter-grid>`;
};
