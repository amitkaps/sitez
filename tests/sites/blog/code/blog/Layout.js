// Only the nearest layout wraps a page, so this one puts itself inside the site's.
import { html } from "sitez";
import Layout from "../Layout.js";

export default ({ page, site, children }) =>
  Layout({
    site,
    children: html`
      <article>
        ${page.date && html`<p><time>${page.date}</time></p>`} ${children}
        <p><a href="/blog/">All posts</a></p>
      </article>
    `,
  });
