/** @prose
 * # Markz warnings
 *
 * Syntax Markz kept as text or read in its own way, such as `*emphasis*` or an element with no
 * closing line. The page still builds, so a warning never fails `build`; it is printed with the
 * file and line, so the author can write the supported form instead.
 */
import { position, type Document } from 'markz';

export interface MarkzWarning {
	file: string;
	/** 1-based, as editors count. */
	line: number;
	column: number;
	code: string;
	message: string;
	instead: string;
}

export function markzWarnings(file: string, doc: Document): MarkzWarning[] {
	if (doc.warnings.length === 0) return [];
	const at = position(doc.source);
	return doc.warnings.map(({ start, code, message, instead }) => {
		const { line, column } = at(start);
		return { file, line, column: column + 1, code, message, instead };
	});
}

/** `prose/about.md:3:7: `*emphasis*`, write `_emphasis_` instead (star-emphasis)`, the file as `name` gives it. */
export function formatWarning(warning: MarkzWarning, name: (file: string) => string): string {
	const { file, line, column, code, message, instead } = warning;
	return `${name(file)}:${line}:${column}: ${message}, write ${instead} instead (${code})`;
}
