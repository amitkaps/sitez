/** @prose
 * # Check
 *
 * `sitez check`: whether the site's files are as they should be, before anything builds. oxfmt
 * formats `prose/` and `pattern/` in one style, and its Markdown output is Markz's canonical form,
 * so one formatter covers both folders; oxlint lints the patterns; svelte-check type-checks them;
 * and Markz's warnings, which `build` prints but never fails on, are problems here. Every problem
 * is one line, `file:line:col: message`, named from where `sitez` runs, and any problem fails.
 * `--fix` formats the files and applies oxlint's safe fixes first, then reports what's left.
 *
 * The style is Sitez's, not configured: tabs, single quotes, 100 columns
 * (`runtime/oxfmtrc.json`). oxfmt and oxlint are the ones Vite+ vendors, so they stay the
 * versions the rest of Sitez's toolchain was released with.
 */
import { execFile } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync
} from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parse } from '@amitkaps/markz';
import { discover } from './discover.ts';
import { shownFrom } from './errors.ts';
import { SITE_FILE } from './root.ts';
import { cacheDir, runtime, svelteOptions } from './vite.ts';
import { formatWarning, markzWarnings } from './warnings.ts';

export interface CheckResult {
	/** One line per problem, in the order the tools ran. */
	problems: string[];
}

export async function check(root: string, { cwd = root, fix = false } = {}): Promise<CheckResult> {
	const shown = shownFrom(cwd);
	const has = (folder: string) => existsSync(join(root, folder));
	const folders = ['prose', 'pattern'].filter(has);
	const config = ['-c', join(runtime, 'oxfmtrc.json')];

	const format = async () => {
		if (folders.length === 0) return [];
		if (fix) await tool('oxfmt', [...config, '--write', ...folders], root);
		const unformatted = await tool('oxfmt', [...config, '--list-different', ...folders], root);
		return lines(unformatted).map(
			(file) => `${shown(join(root, file))}: isn't formatted. sitez check --fix formats it.`
		);
	};
	const lint = async () => {
		if (!has('pattern')) return [];
		const out = await tool('oxlint', ['-f', 'unix', ...(fix ? ['--fix'] : []), 'pattern'], root);
		return lines(out).flatMap((line) => {
			const found = /^(.+?):(\d+):(\d+): (.*)$/.exec(line);
			return found ? [`${shown(join(root, found[1]!))}:${found[2]}:${found[3]}: ${found[4]}`] : [];
		});
	};
	const types = async () => (has('pattern') ? svelteCheck(root, shown) : []);
	const markz = async () =>
		[
			join(root, SITE_FILE),
			...discover(root)
				.filter((page) => page.kind === 'prose')
				.map((page) => page.file)
		]
			.flatMap((file) => markzWarnings(file, parse(readFileSync(file, 'utf8'))))
			.map((warning) => formatWarning(warning, shown));

	// --fix changes files, so each tool sees the last one's fixes; otherwise they run at once.
	const steps = [format, lint, types, markz];
	const found: string[][] = [];
	if (fix) for (const step of steps) found.push(await step());
	else found.push(...(await Promise.all(steps.map((step) => step()))));
	return { problems: found.flat() };
}

/** @prose
 * svelte-check needs no `tsconfig` or `node_modules` in the site: it resolves Svelte's types
 * itself. It runs in a folder of Sitez's, in the cache folder, holding a link to `pattern/`, a
 * `tsconfig` and a Svelte config that compiles as Sitez does: svelte-check looks for a config up
 * the tree from each file, so a site inside a larger repo would otherwise be checked by that
 * repo's. Svelte's `state_referenced_locally` is ignored, since a page renders once and an
 * island's props are set once, from the server, so reading one at the top of a script is always
 * what's meant.
 */
async function svelteCheck(root: string, shown: (file: string) => string): Promise<string[]> {
	const real = realpathSync(root);
	const workspace = join(cacheDir(real), 'check');
	rmSync(workspace, { recursive: true, force: true });
	mkdirSync(workspace, { recursive: true });
	symlinkSync(join(real, 'pattern'), join(workspace, 'pattern'), 'dir');
	writeFileSync(
		join(workspace, 'tsconfig.json'),
		JSON.stringify({
			compilerOptions: {
				target: 'esnext',
				module: 'esnext',
				moduleResolution: 'bundler',
				strict: true,
				allowJs: true,
				skipLibCheck: true,
				noEmit: true,
				allowImportingTsExtensions: true,
				preserveSymlinks: true,
				types: []
			},
			include: ['pattern/**/*']
		})
	);
	writeFileSync(
		join(workspace, 'svelte.config.js'),
		`export default { compilerOptions: ${JSON.stringify(svelteOptions)} };\n`
	);
	const out = await tool(
		'svelte-check',
		[
			'--workspace',
			workspace,
			'--output',
			'machine',
			'--compiler-warnings',
			'state_referenced_locally:ignore'
		],
		workspace
	);
	return lines(out).flatMap((line) => {
		const found = /^\d+ (ERROR|WARNING) "(.+?)" (\d+):(\d+) (".*")$/.exec(line);
		if (!found) return [];
		const message = (JSON.parse(found[5]!) as string).split('\n')[0];
		return [`${shown(join(root, found[2]!))}:${found[3]}:${found[4]}: ${message}`];
	});
}

function lines(text: string): string[] {
	return text
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/** @prose
 * The tools are Sitez's own dependencies, run with the Node running Sitez, from the site's root.
 * A tool exits non-zero when it finds problems, which is its answer, not a failure.
 */
function tool(name: string, args: string[], cwd: string): Promise<string> {
	const bin = binOf(name);
	return new Promise((done, fail) => {
		execFile(
			process.execPath,
			[bin, ...args],
			{ cwd, maxBuffer: 64 * 1024 * 1024 },
			(error, stdout, stderr) => {
				if (error && typeof error.code !== 'number') {
					fail(new Error(`${name} didn't run: ${error.message}\n${stderr}`));
				} else {
					done(stdout);
				}
			}
		);
	});
}

/** svelte-check is Sitez's own dependency; oxfmt and oxlint come with Vite+, at its versions. */
function binOf(name: string): string {
	const sitez = createRequire(import.meta.url);
	const vitePlus = createRequire(sitez.resolve('vite-plus/package.json'));
	for (const require of [sitez, vitePlus]) {
		for (const folder of require.resolve.paths(name) ?? []) {
			const bin = join(folder, name, 'bin', name);
			if (existsSync(bin)) return bin;
		}
	}
	throw new Error(`Sitez can't find ${name}, which it depends on. Reinstall Sitez.`);
}
