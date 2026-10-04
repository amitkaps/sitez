import { html } from "sitez";

export default ({ pages, page }) => html`
  <ul>
    ${pages
      .filter((p) => p.url !== page.url)
      .map((p) => html`<li><a href=${p.url}>${p.title}</a></li>`)}
  </ul>
`;
