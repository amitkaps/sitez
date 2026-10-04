import { html } from "sitez";
import TagFilter from "../TagFilter.js";

export const metadata = { title: "Blog" };

export default ({ pages }) => {
  const posts = pages
    .filter((p) => p.url.startsWith("/blog/") && p.date)
    .toSorted((a, b) => (a.date < b.date ? 1 : -1));
  return html`
    <h1>Blog</h1>
    ${TagFilter({ posts })}
  `;
};
