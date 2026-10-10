/** @prose
 * # What a page's elements ship
 *
 * Which elements a page uses that send something to the browser: CSS from a top-level `<style>`,
 * or behavior from a top-level `<script>`. A page's finished HTML is scanned for its tags, and an
 * element with neither part ships nothing. A page with no behavior loads no JavaScript, and one
 * with no element CSS links no element stylesheet.
 *
 * The site's script defines each element with behavior under its tag (`bundle.ts`), so the file
 * never names its element (rule 6).
 */
import { parseAst } from "vite-plus";
import { SiteError } from "./errors.ts";
import { lineOf, setupModule, type ElementFile } from "./elementz/file.ts";
import { scan } from "./elementz/markup.ts";

/** An element a page uses, and what it ships. */
export interface Used {
  tag: string;
  /** Absolute path to `@tag.html`, as the site was given. */
  file: string;
  setup: boolean;
  style: boolean;
}

/** @prose
 * The elements a page's finished HTML uses that ship CSS or behavior, sorted by tag. Only real
 * start tags count. Text that shows HTML has its `<` escaped, and a script's or a style's body is
 * code, so neither is taken for an element.
 */
export function usedElements(elements: Map<string, ElementFile>, html: string): Used[] {
  const tags = new Set(scan(html).flatMap((tag) => (tag.kind === "start" ? [tag.name] : [])));
  return [...tags].sort().flatMap((tag) => {
    const element = elements.get(tag);
    if (!element || (!element.script && !element.style)) return [];
    if (element.script) checkImports(element);
    return [{ tag, file: element.file, setup: !!element.script, style: !!element.style }];
  });
}

/** @prose
 * Fails a library imported by URL at the top of an element's `<script>`. The site's one script
 * would fetch it on every page with behavior, whether or not its element is there. The bundler
 * fails such an import anywhere in the script (`bundle.ts`), and this catches it in the element in
 * `dev` too. A script that doesn't parse is left to the bundler, whose message shows the line.
 */
function checkImports(element: ElementFile): void {
  let body;
  try {
    body = parseAst(setupModule(element), { lang: "js" }).body;
  } catch {
    return;
  }
  for (const statement of body) {
    if (statement.type === "ImportDeclaration" && URL.canParse(statement.source.value)) {
      const error = urlImportError(element.file, statement.source.value);
      throw new SiteError(
        element.file,
        `line ${lineOf(element.source, statement.start)}: ${error.message}`,
      );
    }
  }
}

/** The failure for a library imported by URL at the top of a file. */
export function urlImportError(file: string, url: string): SiteError {
  return new SiteError(
    file,
    `this imports ${url} at the top, so every page with an element that has behavior would fetch it. Import it inside the element's setup: const lib = await import("${url}").`,
  );
}
