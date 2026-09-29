import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import { versions } from 'vite-plus/versions';
import pkg from '../package.json' with { type: 'json' };
import { check } from './check.ts';

// svelte-check starts TypeScript, which takes seconds.
describe('sitez check', { timeout: 60_000 }, () => {
	test('a tidy site has no problems', async () => {
		const site = copy('landing');
		expect((await check(site)).problems).toEqual([]);
	});

	test('reports each tool, one line per problem, named from where it runs', async () => {
		const site = copy('landing');
		mkdirSync(join(site, 'prose'));
		writeFileSync(join(site, 'prose', 'about.md'), '# About\n\nSome *stars*.\n');
		writeFileSync(
			join(site, 'pattern', 'Count.svelte'),
			'<script lang="ts">\n\tconst label: string = 1;\n\tdebugger;\n</script>\n\n<p>{label}</p>\n'
		);
		writeFileSync(join(site, 'pattern', 'Messy.svelte'), '<p   class="x">Messy</p>\n');
		const { problems } = await check(site, { cwd: join(site, 'pattern') });
		expect(problems).toContain("../prose/about.md: isn't formatted. sitez check --fix formats it.");
		expect(problems).toContain("Messy.svelte: isn't formatted. sitez check --fix formats it.");
		expect(problems.some((line) => /^Count\.svelte:3:\d+: .*debugger/i.test(line))).toBe(true);
		expect(problems).toContain(
			"Count.svelte:2:8: Type 'number' is not assignable to type 'string'."
		);
		expect(problems).toContain(
			'../prose/about.md:3:6: `*emphasis*`, write `_emphasis_` instead (star-emphasis)'
		);
	});

	test('--fix formats first, and reports what is left', async () => {
		const site = copy('landing');
		writeFileSync(join(site, 'pattern', 'Messy.svelte'), '<p   class="x">Messy</p>\n');
		expect((await check(site, { fix: true })).problems).toEqual([]);
	});
});

// The repo's own `vp check` and a site's `sitez check` format and lint alike only while the two agree.
test("Sitez's oxfmt and oxlint are the ones Vite+ vendors", () => {
	expect(pkg.dependencies.oxfmt).toBe(versions.oxfmt);
	expect(pkg.dependencies.oxlint).toBe(versions.oxlint);
});

function copy(name: string): string {
	const site = join(mkdtempSync(join(tmpdir(), 'sitez-check-')), name);
	cpSync(join(import.meta.dirname, '../test/sites', name), site, { recursive: true });
	return site;
}
