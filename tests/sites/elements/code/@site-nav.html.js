// An element in the frame. It reads `page`, as one in text does.
import { html } from "@amitkaps/sitez";

export default ({ page, pages }) => html`
  <nav>
    ${pages.map((p) =>
      p.url === page.url ? html`<strong>${p.title ?? p.url}</strong>` : html`<a href=${p.url}>${p.title ?? p.url}</a>`,
    )}
  </nav>
`;
