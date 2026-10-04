import { html } from "sitez";

// The Jekyll layout printed both for every page, tagline included when empty,
// so the spacing below the title is the same on pages without one.
export default ({ page }) => html`
  <h1 class="title">${page.title}</h1>
  <p class="tagline">${page.tagline ?? ""}</p>
`;
