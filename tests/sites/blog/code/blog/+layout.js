// Only the nearest layout wraps a page, so this one puts itself inside the site's, head included.
import { html } from "sitez";
import layout from "../+layout.js";

export { head } from "../+layout.js";

export default ({ page, site, children }) =>
  layout({
    site,
    children: html`
      <article>
        ${page.date && html`<p><time>${page.date}</time></p>`} ${children}
        <p><a href="/blog/">All posts</a></p>
      </article>
    `,
  });
