#!/usr/bin/env node
/** @prose
 * # The command
 *
 * `sitez` and its five commands, the whole interface a site's author sees. The command finds the
 * site first, so every command runs the same way from any folder inside it, then runs. A
 * `SiteError` prints as `file: message` and exits 1; anything else is a Sitez bug and prints its
 * stack.
 */
import { relative } from 'node:path';
import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { build } from './build.ts';
import { SiteError } from './errors.ts';
import { findRoot } from './root.ts';
import { formatWarning } from './warnings.ts';

const commands = {
	dev: 'serve with live reload',
	build: 'write dist/',
	preview: 'serve dist/ as it will be deployed',
	check: 'format, lint and type-check',
	deploy: 'publish dist/'
} as const;

type Command = keyof typeof commands;

const usage = [
	'Usage: sitez <command>',
	'',
	...Object.entries(commands).map(([name, what]) => `  ${name.padEnd(8)} ${what}`),
	'',
	'Run it anywhere inside a site: the folder holding site.md.'
].join('\n');

/** @prose
 * Runs one command line and returns the exit code, so tests can call it without a process. Each
 * command lands with its step in `prose/plan.md`; until then it says it isn't built.
 */
export async function run(argv: string[], cwd: string, out = console): Promise<number> {
	const { values, positionals } = parseArgs({
		args: argv,
		options: { help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' } },
		allowPositionals: true,
		strict: false
	});
	if (values.version) {
		out.log(pkg.version);
		return 0;
	}
	const [name] = positionals;
	if (values.help || name === undefined) {
		out.log(usage);
		return name === undefined && !values.help ? 1 : 0;
	}
	if (!isCommand(name)) {
		out.error(`sitez: unknown command '${name}'\n\n${usage}`);
		return 1;
	}
	try {
		const root = findRoot(cwd);
		if (name === 'build') {
			const result = await build(root);
			for (const warning of result.warnings) {
				out.error(formatWarning(warning, (file) => relative(cwd, file)));
			}
			const ms = Math.round(result.ms);
			const n = result.pages.length;
			out.log(
				`${n} ${n === 1 ? 'page' : 'pages'} in ${ms} ms → ${relative(cwd, result.outDir) || '.'}`
			);
			return 0;
		}
		out.error(`sitez: '${name}' isn't built yet`);
		return 1;
	} catch (error) {
		if (!(error instanceof SiteError)) throw error;
		// An error about the folder sitez ran in, such as there being no site, is sitez's own.
		out.error(`${relative(cwd, error.file) || 'sitez'}: ${error.message}`);
		return 1;
	}
}

function isCommand(name: string): name is Command {
	return Object.hasOwn(commands, name);
}

if (import.meta.main) process.exitCode = await run(process.argv.slice(2), process.cwd());
