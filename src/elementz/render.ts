/** @prose
 * # The build's renderer
 *
 * Turns a template value into an HTML string. Each place a value can go means what the HTML
 * tokenizer makes of it there. The rules are in
 * [elementz.md](../../docs/elementz.md#html), and `render.test.ts` holds a case for each.
 */
import { isRaw, isTemplate, raw } from "./html.ts";

/** @prose
 * A template the renderer can't write. The renderer sees only the value, so the element's renderer
 * (`elements.ts`) catches this and names the file.
 */
export class TemplateError extends Error {
  override name = "TemplateError";
}

/** @prose
 * Renders a template, or any value as text. Rendering is synchronous, so a promise anywhere in it
 * fails ([elementz.md](../../docs/elementz.md#the-template)). Data reaches an element through its
 * `data` attribute, read before it renders.
 */
export function render(value: unknown): string {
  if (isTemplate(value)) return renderTemplate(value);
  return text(resolve(value));
}

function renderTemplate({
  strings,
  values,
}: {
  strings: readonly string[];
  values: readonly unknown[];
}): string {
  const resolved = values.map(resolve);
  const scan = new Scanner();
  for (let i = 0; i < strings.length; i++) {
    scan.read(strings[i]!);
    if (i < values.length) scan.value(resolved[i], strings[i + 1]!);
  }
  return scan.out;
}

/** A value with its templates rendered, as `Raw`. */
function resolve(value: unknown): unknown {
  if (typeof (value as { then?: unknown } | null)?.then === "function") {
    throw new TemplateError(
      "a template holds a promise, and rendering doesn't wait. Read data with a data attribute, or compute the value without await.",
    );
  }
  if (isTemplate(value)) return raw(renderTemplate(value));
  if (Array.isArray(value)) return value.map(resolve);
  return value;
}

/** A value in text, where `false` is nothing (elementz.md says why). */
function text(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (isRaw(value)) return value.value;
  if (Array.isArray(value)) return value.map(text).join("");
  return escape(stringOf(value));
}

/** A value in an attribute is text, so a template there fails. */
function attribute(value: unknown): string {
  if (isRaw(value) || (Array.isArray(value) && value.some((item) => isRaw(item)))) {
    throw new TemplateError("a template can't go in an attribute, which holds only text.");
  }
  if (Array.isArray(value)) value.forEach(attribute);
  return stringOf(value ?? "");
}

/** @prose
 * A value as text, wherever it goes. A function fails, and so does a plain object, since
 * `[object Object]` is never what a page means. Arrays, dates and numbers write as `String` does.
 */
function stringOf(value: unknown): string {
  if (typeof value === "function") throw functionError();
  if (isPlainObject(value)) {
    throw new TemplateError("a template holds an object where text goes. Write one of its fields.");
  }
  return String(value as string);
}

const functionError = () =>
  new TemplateError(
    "a template holds a function, which can't run at build time. An event handler belongs in the element's <script>, which runs in the browser.",
  );

const isPlainObject = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

type State =
  | "data"
  | "tag-open"
  | "end-tag-open"
  | "tag-name"
  | "before-attribute-name"
  | "attribute-name"
  | "after-attribute-name"
  | "before-attribute-value"
  | "double-quoted"
  | "single-quoted"
  | "unquoted"
  | "after-quoted"
  | "self-closing"
  | "markup-declaration"
  | "comment-start"
  | "comment"
  | "bogus-comment"
  | "rawtext";

/** @prose
 * ## Where a value is
 *
 * The scanner follows the HTML tokenizer through the template's static strings, so it knows
 * where each value lands. It writes the output as it goes, because a value can take back
 * what came before it. A `null` after `name=` removes the name, and `true` removes the `=`.
 *
 * A value right after `name=` is the whole attribute only when a space or `>` follows it. That's
 * htl's test, where these rules began. So `href=${base}/x` is part of an unquoted value, escaped as entities.
 */
class Scanner {
  out = "";
  private state: State = "data";
  private tagStart = 0;
  private tagName = "";
  private attributeStart = 0;
  private dashes = 0;

  value(value: unknown, next: string): void {
    switch (this.state) {
      case "data":
        this.out += text(value);
        return;
      case "before-attribute-value": {
        this.state = "unquoted";
        if (/^[\s>]/.test(next)) {
          if (value === null || value === undefined || value === false) {
            this.out = this.out.slice(0, this.attributeStart).trimEnd();
            this.state = "before-attribute-name";
          } else if (value === true) {
            this.out = this.out.replace(/\s*=\s*$/, "");
            this.state = "after-attribute-name";
          } else {
            this.out += `"${escape(attribute(value))}"`;
            this.state = "after-quoted";
          }
          return;
        }
        this.out += attribute(value).replace(/[\s>&"'<=`]/g, entity);
        return;
      }
      case "unquoted":
        this.out += attribute(value).replace(/[\s>&"'<=`]/g, entity);
        return;
      case "double-quoted":
      case "single-quoted":
        this.out += escape(attribute(value));
        return;
      case "rawtext": {
        if (value === null || value === undefined) return;
        if (typeof value === "function") throw functionError();
        const content = isRaw(value) ? value.value : stringOf(value);
        if (new RegExp(`</${this.tagName}[\\s/>]`, "i").test(content + " ")) {
          throw new TemplateError(
            `a value in <${this.tagName}> holds </${this.tagName}>, which would end it early.`,
          );
        }
        this.out += content;
        return;
      }
      case "comment":
        return;
      default:
        throw new TemplateError(
          "a template holds a value where a tag's name or an attribute's name goes. A value can only be an attribute's value, written name=${value} or name=\"${value}\".",
        );
    }
  }

  read(input: string): void {
    for (let i = 0; i < input.length; i++) {
      const c = input[i]!;
      const at = this.out.length;
      this.out += c;
      switch (this.state) {
        case "data":
          if (c === "<") this.state = "tag-open";
          break;
        case "tag-open":
          if (c === "!") this.state = "markup-declaration";
          else if (c === "/") this.state = "end-tag-open";
          else if (/[a-zA-Z]/.test(c)) [this.state, this.tagStart] = ["tag-name", at];
          else if (c === "?") this.state = "bogus-comment";
          else this.state = c === "<" ? "tag-open" : "data";
          break;
        case "end-tag-open":
          if (/[a-zA-Z]/.test(c)) [this.state, this.tagStart] = ["tag-name", at];
          else this.state = c === ">" ? "data" : "bogus-comment";
          break;
        case "tag-name":
          if (/[\s/>]/.test(c)) {
            this.tagName = this.out.slice(this.tagStart, at).toLowerCase();
            this.state =
              c === ">" ? this.afterTag() : c === "/" ? "self-closing" : "before-attribute-name";
          }
          break;
        case "before-attribute-name":
        case "after-attribute-name":
        case "after-quoted":
          if (/\s/.test(c))
            this.state = this.state === "after-quoted" ? "before-attribute-name" : this.state;
          else if (c === "/") this.state = "self-closing";
          else if (c === ">") this.state = this.afterTag();
          else if (c === "=" && this.state === "after-attribute-name")
            this.state = "before-attribute-value";
          else [this.state, this.attributeStart] = ["attribute-name", at];
          break;
        case "attribute-name":
          if (/\s/.test(c)) this.state = "after-attribute-name";
          else if (c === "/") this.state = "self-closing";
          else if (c === ">") this.state = this.afterTag();
          else if (c === "=") this.state = "before-attribute-value";
          break;
        case "before-attribute-value":
          if (c === '"') this.state = "double-quoted";
          else if (c === "'") this.state = "single-quoted";
          else if (c === ">") this.state = this.afterTag();
          else if (!/\s/.test(c)) this.state = "unquoted";
          break;
        case "double-quoted":
        case "single-quoted":
          if (c === (this.state === "double-quoted" ? '"' : "'")) this.state = "after-quoted";
          break;
        case "unquoted":
          if (/\s/.test(c)) this.state = "before-attribute-name";
          else if (c === ">") this.state = this.afterTag();
          break;
        case "self-closing":
          if (c === ">") this.state = "data";
          else if (!/\s/.test(c)) [this.state, this.attributeStart] = ["attribute-name", at];
          break;
        case "markup-declaration":
          this.state = c === "-" ? "comment-start" : c === ">" ? "data" : "bogus-comment";
          break;
        case "comment-start":
          [this.state, this.dashes] = c === "-" ? ["comment", 0] : ["bogus-comment", 0];
          break;
        case "comment":
          if (c === ">" && this.dashes >= 2) this.state = "data";
          this.dashes = c === "-" ? this.dashes + 1 : 0;
          break;
        case "bogus-comment":
          if (c === ">") this.state = "data";
          break;
        case "rawtext": {
          const end = `</${this.tagName}`;
          if (c === "<" && input.slice(i, i + end.length).toLowerCase() === end) {
            this.out += input.slice(i + 1, i + end.length);
            i += end.length - 1;
            this.state = "tag-name";
            this.tagStart = at + 2;
          }
          break;
        }
      }
    }
  }

  /** What follows a start tag's `>`. `<script>` and `<style>` hold raw text up to their end tag. */
  private afterTag(): State {
    const start = this.out.lastIndexOf("<", this.tagStart);
    const isEnd = this.out[start + 1] === "/";
    return !isEnd && (this.tagName === "script" || this.tagName === "style") ? "rawtext" : "data";
  }
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for HTML, in text and in a quoted attribute alike. */
export const escape = (s: string): string => s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

const entity = (c: string): string => `&#${c.charCodeAt(0)};`;
