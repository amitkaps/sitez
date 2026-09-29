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
import { build, type BuildResult } from './build.ts';
import { check } from './check.ts';
import { deploy } from './deploy.ts';
import { dev } from './dev.ts';
import { preview } from './preview.ts';
import { SiteError, shownFrom, siteErrorText } from './errors.ts';
import { report } from './report.ts';
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
	'Run it anywhere inside a site: the folder holding site.md.',
	'`--port 4000` serves dev or preview on another port; `check --fix` formats and fixes first.'
].join('\n');

/** @prose
 * Runs one command line and returns the exit code, so tests can call it without a process. `dev`
 * and `preview` run until Ctrl-C.
 */
export async function run(argv: string[], cwd: string, out = console): Promise<number> {
	const { values, positionals } = parseArgs({
		args: argv,
		options: {
			help: { type: 'boolean', short: 'h' },
			version: { type: 'boolean', short: 'v' },
			port: { type: 'string', short: 'p' },
			fix: { type: 'boolean' }
		},
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
	const shown = shownFrom(cwd);
	const port = values.port === undefined ? undefined : Number(values.port);
	const printBuild = (result: BuildResult) => {
		for (const warning of result.warnings) out.error(formatWarning(warning, shown));
		out.log(report(result, relative(cwd, result.outDir) || '.'));
	};
	const serveUntilStopped = async (server: { close(): Promise<void> }, message: string) => {
		out.log(`${message} Ctrl-C stops it.`);
		await new Promise((resolve) => process.once('SIGINT', resolve));
		await server.close();
	};
	try {
		const root = findRoot(cwd);
		if (name === 'build') {
			printBuild(await build(root));
		} else if (name === 'dev') {
			const log = (line: string) => out.error(line);
			const server = await dev(root, { port, cwd, warn: log, error: log });
			await serveUntilStopped(server, `Serving at ${server.url}, drafts included.`);
		} else if (name === 'preview') {
			const server = await preview(root, { port });
			await serveUntilStopped(server, `Serving dist/ at ${server.url}, as a host would.`);
		} else if (name === 'check') {
			const { problems } = await check(root, { cwd, fix: values.fix === true });
			for (const problem of problems) out.error(problem);
			const n = problems.length;
			out.log(n === 0 ? 'No problems.' : `${n} ${n === 1 ? 'problem' : 'problems'}.`);
			return n === 0 ? 0 : 1;
		} else {
			const deployed = await deploy(root);
			printBuild(deployed.build);
			out.log(
				deployed.changed
					? `Published to gh-pages on ${deployed.remote}. GitHub Pages serves it when the repo's Pages source is that branch.`
					: 'Nothing to publish: gh-pages already holds this build.'
			);
		}
		return 0;
	} catch (error) {
		if (!(error instanceof SiteError)) throw error;
		out.error(siteErrorText(error, cwd));
		return 1;
	}
}

function isCommand(name: string): name is Command {
	return Object.hasOwn(commands, name);
}

if (import.meta.main) process.exitCode = await run(process.argv.slice(2), process.cwd());
