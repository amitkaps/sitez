/** @prose
 * # Rendering a page
 *
 * A page becomes one complete HTML document, with every element in it rendered. Everything awaits
 * (rule 5), so the HTML is finished when it's written. An element's markup file is a module whose
 * default export returns a template, and the build calls it and renders the result with its own
 * renderer (`runtime/render.ts`). The frame and the rest of the page's HTML are in `head.ts` and
 * `elements.ts`, and `site.ts` puts the parts together.
 */
import { SiteError } from "./errors.ts";
import { SLOT } from "./head.ts";
import type { Metadata, PageData } from "./metadata.ts";
import { render } from "./runtime/render.ts";

export interface Props {
  page: PageData;
  pages: PageData[];
  site: Metadata;
}

/** @prose
 * Calls a module's default export with `props` and renders what it returns. The result is trimmed,
 * so a template written across lines can still sit inside a paragraph.
 */
export async function renderModule(
  file: string,
  module: Record<string, unknown>,
  props: object,
): Promise<string> {
  const fn = module.default;
  if (typeof fn !== "function") {
    throw new SiteError(
      file,
      "this element has no default export to render. Write export default ({ page }) => html`…`, a function returning its HTML.",
    );
  }
  const out = await guard(file, async () =>
    render(await (fn as (props: object) => unknown)(props)),
  );
  return out.trim();
}

/** The page's HTML in the place the frame keeps for it. */
export function inFrame(frame: string, body: string): string {
  return frame.replace(SLOT, () => body);
}

/** @prose
 * An element that throws while rendering is a mistake in the site, not in Sitez. The build fails
 * naming the file that was rendering. The error's own stack names the module it came from, which
 * for a failed `await` is the data module, not the element. A template the renderer refuses says
 * why in its own words.
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
