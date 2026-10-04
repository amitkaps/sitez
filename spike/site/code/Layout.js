import { html } from "sitez";
import ArticleHeader from "./ArticleHeader.js";

const nav = [
  { href: "/workshops/", label: "Workshops" },
  { href: "/essays/", label: "Essays" },
  { href: "/talks/", label: "Talks" },
  { href: "/teaching/", label: "Teaching" },
  { href: "/sowhat/", label: "SoWhAt" },
  { href: "/quotes/", label: "Quotes" },
  { href: "/about/", label: "About" },
];

export default ({ page, children }) => html`
  <header>
    <div class="name"><a href="/">amitkaps</a></div>
    <nav>
      <ul>
        ${nav.map((item) => html`<li><a href=${item.href}>${item.label}</a></li>`)}
      </ul>
    </nav>
  </header>
  <main>
    <article>${ArticleHeader({ page })} ${children}</article>
  </main>
  <footer>
    <p>
      <small>Handcrafted by <a href="/about/">Amit Kapoor</a></small>
    </p>
  </footer>
`;
