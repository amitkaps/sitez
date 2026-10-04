/** @prose
 * # Rendering a page
 *
 * A page becomes one complete HTML document. The page renders first, then its layout around it
 * (rule 2), and the whole goes in the document every page shares. The page renders on its own
 * first, because a JS page's title can come from its own `<h1>` and the layout needs that title.
 * Everything awaits (rule 5), so the HTML is finished when it's written. The head's title,
 * description and links come from metadata, and `Head.js` adds the rest.
 *
 * A page, layout or component is a module whose default export returns a template. The build
 * calls it and renders the result with its own renderer (`runtime/render.ts`).
 */
import { SiteError } from "./errors.ts";
import { checkHead, escape } from "./head.ts";
import type { Metadata, PageData } from "./metadata.ts";
import { raw } from "./runtime/html.ts";
import { render } from "./runtime/render.ts";

export interface Props {
  page: PageData;
  pages: PageData[];
  site: Metadata;
}

// Where the page goes in its layout's HTML, as the layout's `children`.
const slot = "<sitez-children></sitez-children>";

/** @prose
 * Calls a module's default export with `props` and renders what it returns. The result is trimmed,
 * so a template written across lines can still sit inside a paragraph. `kind` names what the file
 * is when it has no function to call.
 */
export async function renderModule(
  file: string,
  module: Record<string, unknown>,
  props: object,
  kind = "page",
): Promise<string> {
  const fn = module.default;
  if (typeof fn !== "function") {
    throw new SiteError(
      file,
      `this ${kind} has no default export to render. Write export default ({ page }) => html\`…\`, a function returning its HTML.`,
    );
  }
  const out = await guard(file, async () =>
    render(await (fn as (props: object) => unknown)(props)),
  );
  return out.trim();
}

/** @prose
 * The layout renders with a marker as its `children`, and the page's HTML replaces it. A layout
 * that doesn't render its children, or renders them twice, fails the build. Either way the page
 * would silently not be what its file says.
 */
export async function renderLayout(
  file: string,
  module: Record<string, unknown>,
  props: Props,
  body: string,
): Promise<string> {
  const out = await renderModule(file, module, { ...props, children: raw(slot) }, "layout");
  const count = out.split(slot).length - 1;
  if (count !== 1) {
    throw new SiteError(
      file,
      count === 0
        ? `this layout doesn't render its page. Write \${children} where ${props.page.url} goes.`
        : `this layout renders its page ${count} times. Keep one \${children}.`,
    );
  }
  return out.replace(slot, () => body);
}

/** `Head.js`'s output, which can't write a tag Sitez writes from metadata (`head.ts`). */
export async function renderHead(
  file: string,
  module: Record<string, unknown>,
  props: Props,
): Promise<string> {
  const out = await renderModule(file, module, props, "head");
  checkHead(file, out);
  return out;
}

/** @prose
 * The document every page shares, in the site's `lang`. Sitez's head tags come from the page's
 * metadata (`head.ts`), then whatever `Head.js` adds.
 */
export function document(site: Metadata, tags: string, head: string, body: string): string {
  return `<!doctype html>
<html lang="${escape(site.lang as string)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${tags}
${head}
</head>
<body>
${body}
</body>
</html>
`;
}

/** @prose
 * A page, layout or component that throws while rendering is a mistake in the site, not in
 * Sitez. The build fails naming the file that was rendering. The error's own stack names the
 * module it came from, which for a failed `await` is the data module, not the page. A template
 * the renderer refuses says why in its own words.
 */
async function guard<T>(file: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof SiteError) throw error;
    const { name, message } = error instanceof Error ? error : { name: "", message: String(error) };
    if (name === "TemplateError") throw new SiteError(file, message, { cause: error });
    throw new SiteError(file, `failed to render: ${message}`, { cause: error });
  }
}
