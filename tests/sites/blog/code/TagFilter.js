// Writes what the tag-filter island will wire: a button per tag, and each post with its tags.
import { html } from "sitez";

export default ({ posts }) => {
  const tags = [...new Set(posts.flatMap((p) => p.tags ?? []))].sort();
  return html`
    <tag-filter>
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
    </tag-filter>
  `;
};
