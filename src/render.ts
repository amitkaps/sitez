/** @prose
 * # Rendering a page
 *
 * A page becomes one complete HTML document, with every element in it rendered (rule 5). An
 * element's template gets what Sitez adds to its scope, `page`, `pages` and `site`, beside its
 * own `attrs` and `html` (`elementz/elements.ts`). The frame is in `head.ts`, and `site.ts` puts
 * the parts together.
 */
import { SLOT } from "./head.ts";
import type { Metadata, PageData } from "./metadata.ts";

/** What Sitez adds to every template's scope. */
export interface Props {
  page: PageData;
  pages: PageData[];
  site: Metadata;
}

/** The names of `Props`, which the template module takes as parameters. */
export const SCOPE = ["page", "pages", "site"];

/** The page's HTML in the place the frame keeps for it. */
export function inFrame(frame: string, body: string): string {
  return frame.replace(SLOT, () => body);
}
