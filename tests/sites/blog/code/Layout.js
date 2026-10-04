import { html } from "sitez";

export default ({ site, children }) => html`
  <header>
    <a href="/">${site.name}</a>
    <nav><a href="/blog/">Blog</a> <a href="/about/">About</a></nav>
  </header>

  <main>${children}</main>
`;
