/** @prose
 * # Live elements
 *
 * Which pages load which `@name.live.js` files, and the line that keeps build code and browser code
 * apart (rule 6). A page's HTML is scanned for custom element tags, and each tag that has a `.live`
 * file, found up the tree as a component is, is shipped to that page. A page with none loads no
 * JavaScript. The file's default export is the element, and the page's script defines it under the
 * tag its name gives.
 *
 * The two sides fail apart (`liveBoundary` in `vite.ts`). A `.live` file imported by build code
 * would crash Node, where `HTMLElement` doesn't exist. A component or layout imported by a `.live`
 * file would bundle whatever it imports. Both fail the build, naming the file that imports.
 */
import { readFileSync } from "node:fs";
import { parseAst } from "vite";
import { nearest } from "./discover.ts";
import { SiteError } from "./errors.ts";

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
    if (!file) return [];
    checkExports(file);
    return [{ tag, file }];
  });
}

const FUNCTION = new Set(["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"]);

/** @prose
 * Fails a live file whose exports aren't one function, its element (rule 6). Sitez can't run the
 * file in Node, so it reads the syntax. A default export counts only when the function is written
 * in the export. `export default setup` fails even when `setup` is a function, since telling would
 * mean following the name. Any other export fails too. Nothing imports a live file, so what else
 * it exports belongs in a module that both sides can import.
 *
 * A file that doesn't parse is left to the bundler, whose message shows the line.
 */
export function checkExports(file: string): void {
  let body;
  try {
    body = parseAst(readFileSync(file, "utf8"), { lang: file.endsWith(".ts") ? "ts" : "js" }).body;
  } catch {
    return;
  }
  const element = "A live file's default export is its element: export default (el) => { … }.";
  const notWritten = `its default export isn't a function written in the export. ${element}`;
  let found = false;
  for (const statement of body) {
    if (statement.type === "ExportDefaultDeclaration") {
      if (!FUNCTION.has(statement.declaration.type)) throw new SiteError(file, notWritten);
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
