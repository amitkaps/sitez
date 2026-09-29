import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import pkg from '../package.json' with { type: 'json' };
import { run } from './cli.ts';

const blog = join(import.meta.dirname, '../test/sites/blog');

function sitez(argv: string[], cwd = blog) {
	const lines = { log: [] as string[], error: [] as string[] };
	const out = {
		log: (s: string) => lines.log.push(s),
		error: (s: string) => lines.error.push(s)
	} as unknown as Console;
	const code = run(argv, cwd, out);
	return { code, log: lines.log.join('\n'), error: lines.error.join('\n') };
}

describe('sitez', () => {
	test('lists the five commands', () => {
		const { code, log } = sitez(['--help']);
		expect(code).toBe(0);
		for (const name of ['dev', 'build', 'preview', 'check', 'deploy']) expect(log).toContain(name);
	});

	test('with no command, shows usage and fails', () => {
		const { code, log } = sitez([]);
		expect(code).toBe(1);
		expect(log).toMatch(/^Usage: sitez <command>/);
	});

	test('prints its version', () => {
		expect(sitez(['--version']).log).toBe(pkg.version);
	});

	test('rejects an unknown command', () => {
		const { code, error } = sitez(['serve']);
		expect(code).toBe(1);
		expect(error).toMatch(/^sitez: unknown command 'serve'/);
	});

	test('fails outside a site', () => {
		const empty = mkdtempSync(join(tmpdir(), 'sitez-'));
		const { code, error } = sitez(['build'], empty);
		expect(code).toBe(1);
		expect(error).toMatch(/^sitez: no site\.md here/);
	});
});
