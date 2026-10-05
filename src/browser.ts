/** @prose
 * # Elements with behavior
 *
 * Which pages load which `@name.browser.js` files, and the line that keeps build code and browser
 * code apart (rule 6). A page's finished HTML is scanned for custom element tags, and each tag that
 * has a `.browser.js` file is shipped to that page. A page with none loads no JavaScript. The
 * file's default export is the element's class, and the site's script defines it under the tag its
 * name gives.
 *
 * The two sides fail apart (`browserBoundary` in `vite.ts`). A `.browser.js` file imported by
 * build code would crash Node, where `HTMLElement` doesn't exist. An element's markup file imported
 * by a `.browser.js` file would bundle whatever it imports. Both fail the build, naming the file
 * that imports.
 */
import { readFileSync } from "node:fs";
import { parseAst } from "vite";
import type { Elements } from "./discover.ts";
import { SiteError } from "./errors.ts";
import { scan } from "./markup.ts";

export interface Browser {
  tag: string;
  /** Absolute path to the tag's `.browser.js` file, as the site was given. */
  file: string;
}

/** @prose
 * The elements with behavior that a page's finished HTML uses, sorted by tag. Only real start tags
 * count. Text that shows HTML has its `<` escaped, and a script's or a style's body is code, so
 * neither is taken for an element. An element with no `.browser.js` file is left out.
 */
export function findBrowser(elements: Elements, html: string): Browser[] {
  const tags = new Set(scan(html).flatMap((tag) => (tag.kind === "start" ? [tag.name] : [])));
  return [...tags].sort().flatMap((tag) => {
    const file = elements.get(tag)?.browser;
    if (!file) return [];
    checkBrowser(file);
    return [{ tag, file }];
  });
}

const CLASS = new Set(["ClassDeclaration", "ClassExpression"]);
const FUNCTION = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);

/** @prose
 * Fails a .browser.js file whose exports aren't one class, its element (rule 6), or that imports a
 * library by URL at the top. The bundler fails such an import anywhere in the site's script
 * (`bundle.ts`), and this catches it in the `.browser.js` file in `dev` too.
 *
 * Exports first. Sitez can't run the file in Node, so it reads the syntax. A default export counts
 * when the class is written in the export, or when it's a call, since a library can make the
 * class. A call that returns something else fails in the browser, where `customElements.define`
 * throws. `export default Filter` fails even when `Filter` is a class, since telling would mean
 * following the name. A function gets its own message, pointing to `connectedCallback`. Any
 * other export fails too. Nothing imports a .browser.js file, so what else it exports belongs in a module
 * that both sides can import.
 *
 * A file that doesn't parse is left to the bundler, whose message shows the line.
 */
export function checkBrowser(file: string): void {
  let body;
  try {
    body = parseAst(readFileSync(file, "utf8"), { lang: file.endsWith(".ts") ? "ts" : "js" }).body;
  } catch {
    return;
  }
  const element =
    "A .browser.js file's default export is its element's class: export default class extends HTMLElement { … }.";
  const notWritten = `its default export isn't a class written in the export. ${element}`;
  let found = false;
  for (const statement of body) {
    if (statement.type === "ImportDeclaration" && URL.canParse(statement.source.value)) {
      throw urlImportError(file, statement.source.value);
    }
    if (statement.type === "ExportDefaultDeclaration") {
      const { type } = statement.declaration;
      if (FUNCTION.has(type)) {
        throw new SiteError(
          file,
          `its default export is a function, which Sitez no longer wraps as an element. ${element} Set the element up in its connectedCallback() { … }.`,
        );
      }
      if (!CLASS.has(type) && type !== "CallExpression") throw new SiteError(file, notWritten);
      found = true;
      continue;
    }
    let what: string;
    if (statement.type === "ExportAllDeclaration") {
      what = `everything from ${statement.source.value}`;
    } else if (statement.type === "ExportNamedDeclaration") {
      const names = statement.declaration
        ? declared(statement.declaration)
        : statement.specifiers.map(({ exported }) =>
            exported.type === "Identifier" ? exported.name : String(exported.value),
          );
      if (names.includes("default")) throw new SiteError(file, notWritten);
      what = names.join(", ");
    } else continue;
    throw new SiteError(
      file,
      `this exports ${what}. ${element} Move anything else into a module in code/, which both files can import.`,
    );
  }
  if (!found) throw new SiteError(file, `this has no default export. ${element}`);
}

/** The names a declaration exports: a function's or a class's, or each variable's. */
function declared(declaration: { id?: unknown; declarations?: unknown }): string[] {
  const ids = Array.isArray(declaration.declarations)
    ? declaration.declarations.map((d: { id: unknown }) => d.id)
    : [declaration.id];
  return ids.map((id) => (id as { name?: string } | null)?.name ?? "a declaration");
}

/** The failure for a library imported by URL at the top of a file. */
export function urlImportError(file: string, url: string): SiteError {
  return new SiteError(
    file,
    `this imports ${url} at the top, so every page with an element that has behavior would fetch it. Import it inside the element's function: const lib = await import("${url}").`,
  );
}
