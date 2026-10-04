import { html } from "@amitkaps/sitez";

export default ({ children }) => html`
  <nav><a href="/">Home</a> <a href="/posts/">Posts</a></nav>
  ${children}
`;
