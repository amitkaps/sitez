import { html } from "@amitkaps/sitez";

export const head = () => html`<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`;

export default ({ site, children }) => html`
  <header>
    <a href="/">${site.name}</a>
    <nav><a href="/blog/">Blog</a> <a href="/about/">About</a></nav>
  </header>

  <main>${children}</main>
`;
