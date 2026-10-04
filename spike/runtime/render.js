/** @prose
 * # The build's renderer
 *
 * A template value to an HTML string, with htl's meaning for each place a value can go, so one
 * tag means the same in both runtimes. In text, a value is escaped, a nested template or `raw`
 * goes in as HTML, an array is each item, and `null`, `undefined` and `false` are nothing. In an
 * unquoted attribute (`href=${link}`), `null`, `undefined` and `false` drop the attribute and
 * `true` leaves it bare. A promise anywhere is awaited, and every promise in a template resolves
 * in parallel. A function fails the build: at build time it can only be a handler meant for an
 * island.
 */
import { isRaw, isTemplate, raw } from "./html.js";

export async function render(value, file) {
  if (isTemplate(value)) return renderTemplate(value, file);
  return content(await value, file);
}

async function renderTemplate({ strings, values }, file) {
  const resolved = await Promise.all(values.map((v) => resolve(v, file)));
  let out = "";
  let state = "text";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    state = scan(strings[i], state);
    if (i === values.length) break;
    const value = resolved[i];
    if (typeof value === "function") {
      throw new Error(
        `${file}: a function in a template rendered at build time. Event handlers belong in an *.island.js file.`,
      );
    }
    if (state === "text") out += content(value, file);
    else if (state === "tag" && out.endsWith("=")) {
      if (value === null || value === undefined || value === false)
        out = out.replace(/\s+[^\s=]+=$/, "");
      else if (value === true) out = out.slice(0, -1);
      else out += `"${escape(String(value))}"`;
    } else if (state !== "tag") out += escape(String(value ?? ""));
    else
      throw new Error(
        `${file}: a value can't go here in a tag. Write name=\${value} or name="\${value}".`,
      );
  }
  return out;
}

/** Promises, and arrays and templates holding them, resolve before the string is written. */
async function resolve(value, file) {
  value = await value;
  if (isTemplate(value)) return raw(await renderTemplate(value, file));
  if (Array.isArray(value)) return Promise.all(value.map((v) => resolve(v, file)));
  return value;
}

function content(value, file) {
  if (value === null || value === undefined || value === false) return "";
  if (isRaw(value)) return value.value;
  if (Array.isArray(value)) return value.map((v) => content(v, file)).join("");
  if (typeof value === "function")
    throw new Error(`${file}: a function in a template rendered at build time.`);
  return escape(String(value));
}

/** The state after one static string: `text`, `tag`, or the quote of the attribute value it's in. */
function scan(s, state) {
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (state === "text") {
      if (c === "<" && /[a-zA-Z/!]/.test(s[i + 1] ?? "")) state = "tag";
    } else if (state === "tag") {
      if (c === '"' || c === "'") state = c;
      else if (c === ">") state = "text";
    } else if (c === state) state = "tag";
  }
  return state;
}

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escape = (s) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
