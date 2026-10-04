/** @prose
 * # Live elements
 *
 * Which pages load which `@name.live.js` files, and the line that keeps build code and browser code
 * apart (rule 6). A page's HTML is scanned for custom element tags, and each tag that has a `.live`
 * file, found up the tree as a component is, is shipped to that page. A page with none loads no
 * JavaScript. The file calls `define`, so loading it is all it takes.
 *
 * The two sides fail apart (`liveBoundary` in `vite.ts`). A `.live` file imported by build code
 * would crash Node, where `HTMLElement` doesn't exist. A component or layout imported by a `.live`
 * file would bundle whatever it imports. Both fail the build, naming the file that imports.
 */
import { nearest } from "./discover.ts";

export interface Live {
  tag: string;
  /** Absolute path to the tag's `.live` file, as the site was given. */
  file: string;
}

/** @prose
 * The live elements a page's finished HTML uses, sorted by tag. Only real start tags count. Text
 * that shows HTML has its `<` escaped, and a script's or a style's body is code, so neither is
 * taken for an element. An element with no `.live` file is plain HTML, and is left out.
 */
export function findLive(root: string, url: string, html: string): Live[] {
  const markup = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/(<(script|style)\b[^>]*>)[\s\S]*?<\/\2>/gi, "$1");
  const tags = new Set(
    [...markup.matchAll(/<([a-z][a-z0-9]*(?:-[a-z0-9]+)+)(?=[\s/>])/g)].map((found) => found[1]!),
  );
  return [...tags].sort().flatMap((tag) => {
    const file = nearest(root, url, `@${tag}.live`);
    return file ? [{ tag, file }] : [];
  });
}
