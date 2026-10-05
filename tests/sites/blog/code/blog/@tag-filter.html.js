// Writes what tag-filter's .browser.js file will wire: a button per tag, and each post with its tags.
import { html } from "@amitkaps/sitez";

export default ({ pages }) => {
  const posts = pages
    .filter((p) => p.url.startsWith("/blog/") && p.date)
    .toSorted((a, b) => (a.date < b.date ? 1 : -1));
  const tags = [...new Set(posts.flatMap((p) => p.tags ?? []))].sort();
  return html`
    <p>
      <button value="" aria-pressed="true">All</button>
      ${tags.map((t) => html`<button value=${t} aria-pressed="false">${t}</button>`)}
    </p>
    <ul>
      ${posts.map(
        (post) =>
          html`<li data-tags=${(post.tags ?? []).join(" ")}>
            <a href=${post.url}>${post.title}</a> <time>${post.date}</time>
          </li>`,
      )}
    </ul>
  `;
};
