/** @prose
 * # Site errors
 *
 * A mistake in the site, as opposed to a bug in Sitez. Every failure a user can cause is one of
 * these, and it names the file and says what to change. The build never guesses its way past
 * one. It prints one without a stack trace, and anything else thrown is a Sitez bug and keeps its
 * stack. The class is elementz's (`elementz/errors.ts`), since an element file's mistakes are too.
 */
import { relative } from "node:path";

import { FileError as SiteError } from "./elementz/errors.ts";

export { SiteError };

/** How every message names a file: relative to a folder, the site's root. */
export function shownFrom(cwd: string): (file: string) => string {
  return (file) => relative(cwd, file) || file;
}

/** @prose
 * A site error as `vite build` and the dev server print it, `file: message`. One about the site's
 * root itself is `sitez`'s own.
 */
export function siteErrorText(error: SiteError, cwd: string): string {
  return `${relative(cwd, error.file) || "sitez"}: ${error.message}`;
}
