import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import { SiteError } from './errors.ts';
import { findRoot } from './root.ts';

const sites = join(import.meta.dirname, '../test/sites');

describe('findRoot', () => {
	test('is the folder holding site.md', () => {
		expect(findRoot(join(sites, 'blog'))).toBe(join(sites, 'blog'));
	});

	test('is found from any folder inside the site', () => {
		expect(findRoot(join(sites, 'blog/prose/blog'))).toBe(join(sites, 'blog'));
		expect(findRoot(join(sites, 'blog/pattern'))).toBe(join(sites, 'blog'));
	});

	test('works for a site with no prose/', () => {
		expect(findRoot(join(sites, 'landing/pattern'))).toBe(join(sites, 'landing'));
	});

	test('fails with no site.md anywhere above, showing what to write', () => {
		const empty = mkdtempSync(join(tmpdir(), 'sitez-'));
		const error = catchError(() => findRoot(empty));
		expect(error.file).toBe(empty);
		expect(error.message).toMatch(/^no site\.md here or in any folder above/);
		expect(error.message).toContain('name: My site');
	});

	test('fails on prose/site.md, found from inside prose/', () => {
		const site = join(sites, 'error-reserved-site-md');
		const error = catchError(() => findRoot(join(site, 'prose')));
		expect(error.file).toBe(join(site, 'prose/site.md'));
		const expected = readFileSync(join(site, 'error.txt'), 'utf8').trim();
		expect(`prose/site.md: ${error.message}`).toBe(expected);
	});
});

function catchError(fn: () => unknown): SiteError {
	try {
		fn();
	} catch (error) {
		if (error instanceof SiteError) return error;
		throw error;
	}
	throw new Error('expected a SiteError');
}
