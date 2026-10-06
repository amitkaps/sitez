/** @prose
 * # An element's CSS is its own
 *
 * Every top-level selector in an element's `<style>` starts with its tag, so its CSS can't reach
 * the rest of the page by accident ([elementz.md](../../docs/elementz.md#css)). Rules inside
 * `@media`, `@supports`, `@container`, `@layer` and `@scope` are at the top too, and are checked.
 * Other at-rules, such as `@keyframes` and `@font-face`, hold no selectors for the page and are
 * left alone. A selector nested inside a rule is the rule's, so it's never checked.
 *
 * This reads CSS only as far as the check needs: comments, strings, brackets and blocks. What
 * isn't valid CSS is left to the bundler.
 */
import type { FileError } from "./errors.ts";
import type { Part } from "./file.ts";

const GROUPS = new Set(["media", "supports", "container", "layer", "scope", "starting-style"]);

export function checkStyle(
  style: Part,
  name: string,
  fail: (at: number, message: string) => FileError,
): void {
  // Comments and strings blanked, so a brace or a comma in one is never read as CSS.
  const css = style.text.replace(/\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, (s) =>
    s[0] === "/" ? " ".repeat(s.length) : s[0] + "x".repeat(s.length - 2) + s[0],
  );
  const own = new RegExp(`^${name}(?![\\w-])`);
  const rules = (from: number, to: number): void => {
    let at = from;
    while (at < to) {
      const brace = find(css, "{", at, to);
      const semicolon = find(css, ";", at, to);
      if (semicolon !== -1 && (brace === -1 || semicolon < brace)) {
        at = semicolon + 1;
        continue;
      }
      if (brace === -1) return;
      const prelude = css.slice(at, brace);
      const end = closingBrace(css, brace, to);
      const atRule = /^\s*@([\w-]+)/.exec(prelude);
      if (atRule) {
        if (GROUPS.has(atRule[1]!.toLowerCase())) rules(brace + 1, end);
      } else {
        let offset = at;
        for (const selector of splitTop(prelude)) {
          const trimmed = selector.trim();
          if (trimmed && !own.test(trimmed)) {
            const start = style.start + offset + selector.indexOf(trimmed);
            throw fail(
              start,
              `the rule ${trimmed} doesn't start with ${name}. Every top-level selector in an element's <style> starts with its tag, as in ${name} ${trimmed}, so its CSS stays its own.`,
            );
          }
          offset += selector.length + 1;
        }
      }
      at = end + 1;
    }
  };
  rules(0, css.length);
}

/** The first `char` at the top level of `css` between `from` and `to`, or -1. */
function find(css: string, char: string, from: number, to: number): number {
  let depth = 0;
  for (let i = from; i < to; i++) {
    const c = css[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === char && depth === 0) return i;
  }
  return -1;
}

/** The `}` that closes the block opened at `open`, or `to` when it's never closed. */
function closingBrace(css: string, open: number, to: number): number {
  let depth = 0;
  for (let i = open; i < to; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return i;
  }
  return to;
}

/** A selector list split at its top-level commas, each piece as written. */
function splitTop(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i];
    if (c === "(" || c === "[") depth++;
    else if (c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      parts.push(prelude.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(prelude.slice(start));
  return parts;
}
