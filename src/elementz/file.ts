/** @prose
 * # An element file
 *
 * `@name.html`, read into its parts: a `<template>` the build writes, with an optional `<script>`
 * first in it, a top-level `<style>` that ships, and a top-level `<script>` that runs in the
 * browser ([elementz.md](../../docs/elementz.md#the-file)). Where a part sits says when it runs.
 *
 * The file is read as HTML is, by its tags, and each part keeps its offsets in the file. So each
 * part becomes a module of its own whose lines are the file's lines (`templateModule`,
 * `setupModule`, `elementStyle`), and an error in one names the line the author wrote. Every check
 * that needs only the file runs here, and fails naming the file and the line
 * ([elementz.md](../../docs/elementz.md#what-the-build-checks)).
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseAst } from "vite";
import { FileError } from "./errors.ts";
import { attribute, scan, type Tag } from "./markup.ts";
import { checkStyle } from "./style.ts";

/** Where a part's text sits in the file, from just after its start tag to its end tag. */
export interface Part {
  start: number;
  end: number;
  text: string;
}

export interface ElementFile {
  /** The element's tag, from the file's name. */
  name: string;
  /** Absolute path to `@name.html`. */
  file: string;
  source: string;
  /** What the build writes, with the template's own `<script>` apart from its markup. */
  template?: { markup: Part; script?: Part };
  style?: Part;
  /** The `setup` the browser runs. */
  script?: Part;
}

/** The names every template has in scope, besides the host's. */
export const OWN_SCOPE = ["attrs", "html"];

/** The tag an element file is named for: `@call-out.html` is `call-out`. */
export const nameOf = (file: string): string => basename(file).slice(1, -".html".length);

/** @prose
 * Reads `file` and checks it. `scope` is what the host adds to the template's scope, such as
 * `page`, and an export of the template's script by one of those names fails, since the template
 * would never see it.
 */
export function readElement(
  file: string,
  scope: string[],
  source = readFileSync(file, "utf8"),
): ElementFile {
  const name = nameOf(file);
  const element: ElementFile = { name, file, source };
  const fail = (at: number, message: string) =>
    new FileError(file, `line ${lineOf(source, at)}: ${message}`);
  const tags = scan(source);
  let at = 0;
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]!;
    outside(source, at, tag.start, fail);
    if (tag.kind === "end") {
      throw fail(tag.start, `</${tag.name}> closes nothing. Remove it.`);
    }
    const kind = tag.name as "template" | "style" | "script";
    if (kind !== "template" && kind !== "style" && kind !== "script") {
      throw fail(
        tag.start,
        `<${tag.name}> is outside the <template>. An element file holds a <template>, a <style> and a <script>, so markup goes inside <template>…</template>.`,
      );
    }
    if (element[kind]) {
      throw fail(tag.start, `this is a second <${kind}>. An element file holds one of each.`);
    }
    const close = closing(tags, i);
    if (close === -1) throw fail(tag.start, `<${kind}> is never closed. Write </${kind}>.`);
    const part = { start: tag.end, end: tags[close]!.start, text: "" };
    part.text = source.slice(part.start, part.end);
    if (kind === "template") {
      element.template = template(element, tag, tags.slice(i + 1, close), part, fail);
    } else {
      if (kind === "script") scriptEnds(source, part, tags[close]!, fail);
      element[kind] = part;
    }
    i = close;
    at = tags[close]!.end;
  }
  outside(source, at, source.length, fail);
  if (element.template?.script) checkBuildScript(element, scope, fail);
  if (element.script) checkSetup(element, fail);
  if (element.style) checkStyle(element.style, name, fail);
  return element;
}

/** The index of the end tag that closes `tags[i]`, counting templates inside a template. */
function closing(tags: Tag[], i: number): number {
  const { name } = tags[i]!;
  let depth = 0;
  for (let j = i + 1; j < tags.length; j++) {
    const tag = tags[j]!;
    if (tag.name !== name) continue;
    if (tag.kind === "start") depth++;
    else if (depth-- === 0) return j;
  }
  return -1;
}

/** Fails on anything but space and comments between the file's parts. */
function outside(
  source: string,
  from: number,
  to: number,
  fail: (at: number, message: string) => FileError,
): void {
  const text = source.slice(from, to).replace(/<!--[\s\S]*?-->/g, (c) => " ".repeat(c.length));
  const found = /\S/.exec(text);
  if (!found) return;
  throw fail(
    from + found.index,
    `this text is outside the <template>. An element file holds a <template>, a <style> and a <script>, so markup goes inside <template>…</template>.`,
  );
}

/** @prose
 * The template's markup, and its `<script>` if it has one. The script comes first, since it gives
 * the markup its names, and a template has at most one. A `<script>` later in the markup would be
 * read as the page's own, which is easy to mistake for the build's.
 */
function template(
  element: ElementFile,
  open: Tag,
  inside: Tag[],
  part: Part,
  fail: (at: number, message: string) => FileError,
): { markup: Part; script?: Part } {
  const { source, name } = element;
  const named = attribute(open, "element")?.value;
  if (named !== undefined && named !== name) {
    throw fail(
      open.start,
      `<template element="${named}"> is in @${name}.html. The file's name is the element's, so write element="${name}" or leave it out.`,
    );
  }
  const shadow = [open, ...inside].find(
    (tag) => tag.kind === "start" && attribute(tag, "shadowrootmode"),
  );
  if (shadow) {
    throw fail(
      shadow.start,
      `shadowrootmode makes a shadow root, and elements have none. Write the markup in the light DOM, with <slot></slot> where the content goes.`,
    );
  }
  for (const slot of inside.filter((tag) => tag.kind === "start" && tag.name === "slot")) {
    if (attribute(slot, "name")) throw fail(slot.start, namedSlot);
  }
  const scripts = inside.filter((tag) => tag.kind === "start" && tag.name === "script");
  const [first, second] = scripts;
  if (second) {
    throw fail(
      second.start,
      `this is a second <script> in the <template>. A template has one, first, whose exports the markup uses.`,
    );
  }
  if (!first) return { markup: part };
  if (/\S/.test(source.slice(part.start, first.start).replace(/<!--[\s\S]*?-->/g, ""))) {
    throw fail(
      first.start,
      `the template's <script> comes after its markup. Move it to the top of the <template>, since it gives the markup its names.`,
    );
  }
  const close = inside[inside.indexOf(first) + 1]!;
  const script = { start: first.end, end: close.start, text: source.slice(first.end, close.start) };
  scriptEnds(source, script, close, fail);
  return {
    script,
    markup: { start: close.end, end: part.end, text: source.slice(close.end, part.end) },
  };
}

export const namedSlot =
  "an element has one slot, with no name, where its content goes. Remove the name.";

/** @prose
 * `</script>` in a script's string or comment ends the script, as it does in any HTML page, and
 * the rest of the code would be read as markup. Only a script that doesn't parse is checked, so a
 * regular expression with a quote in it is never taken for a string.
 */
function scriptEnds(
  source: string,
  script: Part,
  close: Tag,
  fail: (at: number, message: string) => FileError,
): void {
  try {
    parseAst(script.text, { lang: "js" });
    return;
  } catch {}
  const after = source.slice(close.end, source.indexOf("\n", close.end) + 1 || source.length);
  if (!inside(script.text, /\S/.test(after))) return;
  throw fail(
    close.start,
    "this </script> is inside the script's code, and ends the script there, as in any HTML page. Write it <\\/script>.",
  );
}

/** Whether `code` ends inside a string, a template literal or a comment. */
function inside(code: string, lineGoesOn: boolean): boolean {
  const braces: string[] = [];
  let mode = "code";
  for (let i = 0; i < code.length; i++) {
    const c = code[i]!;
    const next = code[i + 1];
    if (mode === "code") {
      if (c === "'" || c === '"' || c === "`") mode = c;
      else if (c === "/" && next === "/") [mode, i] = ["//", i + 1];
      else if (c === "/" && next === "*") [mode, i] = ["/*", i + 1];
      else if (c === "{") braces.push("{");
      else if (c === "}" && braces.pop() === "${") mode = "`";
    } else if (mode === "'" || mode === '"') {
      if (c === "\\") i++;
      else if (c === mode || c === "\n") mode = "code";
    } else if (mode === "`") {
      if (c === "\\") i++;
      else if (c === "`") mode = "code";
      else if (c === "$" && next === "{") {
        braces.push("${");
        [mode, i] = ["code", i + 1];
      }
    } else if (mode === "//") {
      if (c === "\n") mode = "code";
    } else if (c === "*" && next === "/") [mode, i] = ["code", i + 1];
  }
  if (mode === "//") return lineGoesOn;
  return mode !== "code" || braces.includes("${");
}

/** The parsed module, or nothing when it doesn't parse: Vite shows that error with its lines. */
function parsed(code: string) {
  try {
    return parseAst(code, { lang: "js" }).body;
  } catch {
    return undefined;
  }
}

/** @prose
 * The template's script gives the markup its named exports. One named like the template's own
 * scope would be hidden by it, so it fails. A default export fails too, since the template is the
 * module's default.
 */
function checkBuildScript(
  element: ElementFile,
  scope: string[],
  fail: (at: number, message: string) => FileError,
): void {
  const names = [...OWN_SCOPE, ...scope];
  for (const statement of parsed(setupModule(element, element.template!.script!)) ?? []) {
    if (statement.type === "ExportDefaultDeclaration") {
      throw fail(
        statement.start,
        "the template's script has a default export. Its named exports are what the markup uses, so name it: export const chart = …",
      );
    }
    if (statement.type !== "ExportNamedDeclaration") continue;
    const exported = statement.declaration
      ? declared(statement.declaration)
      : statement.specifiers.map(({ exported }) =>
          exported.type === "Identifier" ? exported.name : String(exported.value),
        );
    const clash = exported.find((name) => names.includes(name));
    if (clash) {
      throw fail(
        statement.start,
        `this exports ${clash}, which the template already has (${names.join(", ")}). Rename it.`,
      );
    }
  }
}

/** @prose
 * The browser's script default-exports `setup(el, { signal })`. Sitez 0.3's `.browser.js` file
 * exported a class, so a class fails, saying where its code goes.
 */
function checkSetup(element: ElementFile, fail: (at: number, message: string) => FileError): void {
  const body = parsed(setupModule(element));
  if (!body) return;
  const setup = "export default (el, { signal }) => { … }";
  const found = body.find((statement) => statement.type === "ExportDefaultDeclaration");
  if (!found) {
    throw fail(
      element.script!.start,
      `the <script> has no default export. It exports the element's setup, which the browser runs on each element: ${setup}.`,
    );
  }
  const { type } = found.declaration;
  if (type === "ClassDeclaration" || type === "ClassExpression") {
    throw fail(
      found.start,
      `the <script> exports a class. It exports the element's setup instead, which the browser runs on each element: ${setup}. Move connectedCallback's code into it, and pass signal to each listener.`,
    );
  }
}

/** The names a declaration exports: a function's or a class's, or each variable's. */
function declared(declaration: { id?: unknown; declarations?: unknown }): string[] {
  const ids = Array.isArray(declaration.declarations)
    ? declaration.declarations.map((d: { id: unknown }) => d.id)
    : [declaration.id];
  return ids.map((id) => (id as { name?: string } | null)?.name ?? "a declaration");
}

/** @prose
 * ## The parts as modules
 *
 * Each part becomes the whole file with everything but that part blanked, so its lines and
 * columns are the file's. The template is the script's module with one more export, the default,
 * which is the markup as an `html` literal. Its parameters are the template's scope, so the
 * script's exports, its module's names, are in scope too.
 */
export function templateModule(element: ElementFile, scope: string[]): string {
  const { source } = element;
  const { markup, script } = element.template!;
  const names = [...OWN_SCOPE, ...scope].join(", ");
  const head = script
    ? setupModule(element, script).slice(0, markup.start)
    : blank(source.slice(0, markup.start));
  return `${head}export default ({ ${names} }) => html\`${markup.text}\`;${blank(source.slice(markup.end))}`;
}

/** The browser's script as a module, or the template's script when it's given. */
export function setupModule(element: ElementFile, script = element.script!): string {
  const { source } = element;
  return blank(source.slice(0, script.start)) + script.text + blank(source.slice(script.end));
}

/** @prose
 * The element's CSS, in `@layer elements`, so a site's own CSS has the last word
 * ([elementz.md](../../docs/elementz.md#css)).
 */
export function elementStyle(element: ElementFile): string {
  const { source, style } = element;
  const before = blank(source.slice(0, style!.start));
  return `${before}@layer elements {${style!.text}}${blank(source.slice(style!.end))}`;
}

/** Text with everything but its line breaks blanked, so what follows keeps its line and column. */
const blank = (text: string) => text.replace(/[^\n]/g, " ");

/** The line `at` is on, from 1. */
export function lineOf(source: string, at: number): number {
  let line = 1;
  for (let i = source.indexOf("\n"); i !== -1 && i < at; i = source.indexOf("\n", i + 1)) line++;
  return line;
}
