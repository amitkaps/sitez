/** @prose
 * # Site errors
 *
 * A mistake in the site, as opposed to a bug in Sitez. Every failure a user can cause is one of
 * these, and it names the file and says what to change: the build never guesses its way past
 * one. The CLI prints it without a stack trace; anything else that is thrown is a Sitez bug and
 * keeps its stack.
 */
import { relative } from 'node:path';

export class SiteError extends Error {
	/** The file or folder at fault, as an absolute path. */
	readonly file: string;

	constructor(file: string, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = 'SiteError';
		this.file = file;
	}
}

/** How every message names a file: relative to where `sitez` runs. */
export function shownFrom(cwd: string): (file: string) => string {
	return (file) => relative(cwd, file) || file;
}

/** @prose
 * A site error as every command prints it, `file: message`. One about the folder `sitez` ran in,
 * such as there being no site, is `sitez`'s own.
 */
export function siteErrorText(error: SiteError, cwd: string): string {
	return `${relative(cwd, error.file) || 'sitez'}: ${error.message}`;
}
