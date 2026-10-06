/** @prose
 * # A mistake in a file
 *
 * A mistake in the site, as opposed to a bug in Sitez. Every failure a user can cause is one of
 * these, and it names the file and says what to change. elementz throws it for an element file,
 * and Sitez re-exports it as `SiteError` for every other file (`src/errors.ts`).
 */
export class FileError extends Error {
  /** The file or folder at fault, as an absolute path. */
  declare readonly file: string;

  constructor(file: string, message: string, options?: ErrorOptions) {
    super(message, options);
    // Not enumerable, so Vite's report of an error shows `file: message` and nothing beside it.
    Object.defineProperty(this, "name", { value: "SiteError" });
    Object.defineProperty(this, "file", { value: file });
  }
}
