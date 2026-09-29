/** @prose
 * # The example sites
 *
 * Every site in `test/sites/` is built. A site builds to the files in `test/snapshots/<site>/`,
 * (`files.txt` lists them, `built/` holds the text ones), which are reviewed as they change; an `error-…` site fails with exactly its `error.txt`, the
 * file named relative to the site as the CLI prints it from there.
 */
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import { build } from '../src/build.ts';
import { SiteError } from '../src/errors.ts';

const sites = join(import.meta.dirname, 'sites');
const names = readdirSync(sites, { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

// Snapshots are text; other files are listed by name only.
const text = /\.(html|css|js|xml|svg|txt|json)$/;

describe.each(names.filter((name) => !name.startsWith('error-')))('%s', (name) => {
	test('builds to its snapshot', async () => {
		const outDir = join(mkdtempSync(join(tmpdir(), 'sitez-')), 'dist');
		await build(join(sites, name), { outDir });
		const files = readdirSync(outDir, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => relative(outDir, join(entry.parentPath, entry.name)))
			.sort();
		await expect(files.join('\n') + '\n').toMatchFileSnapshot(`snapshots/${name}/files.txt`);
		for (const file of files.filter((file) => text.test(file))) {
			await expect(readFileSync(join(outDir, file), 'utf8')).toMatchFileSnapshot(
				`snapshots/${name}/built/${file}`
			);
		}
	});
});

describe.each(names.filter((name) => name.startsWith('error-')))('%s', (name) => {
	test('fails with its error.txt', async () => {
		const root = join(sites, name);
		const outDir = join(mkdtempSync(join(tmpdir(), 'sitez-')), 'dist');
		const error = await build(root, { outDir }).then(
			() => undefined,
			(error: unknown) => error
		);
		expect(error).toBeInstanceOf(SiteError);
		const { file, message } = error as SiteError;
		const expected = readFileSync(join(root, 'error.txt'), 'utf8').trim();
		expect(`${relative(root, file)}: ${message}`).toBe(expected);
	});
});
