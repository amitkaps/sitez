/** @prose
 * # Islands
 *
 * Which components are islands (rule 6), read from each component's source: one with browser
 * behavior of its own ships its JavaScript and hydrates, and nothing marks it. What an island is
 * on a given page, the outermost one or a part of another, is only known as the page renders, so
 * this file answers the question per component and `runtime/server.ts` per render. Pages and
 * layouts are never islands: they are what an island sits in.
 */
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { parse } from 'svelte/compiler';
import type { Plugin } from 'vite';
import { SiteError } from './errors.ts';
import type { Info } from './runtime/server.ts';
import { posix } from './discover.ts';
import { asGiven, runtime } from './vite.ts';

export interface Behavior {
	/** What the component does, as a message names it: `an onclick handler on <button>`. */
	what: string;
	line: number;
}

interface Analysis {
	behavior: Behavior | undefined;
	/** The props its `$props()` names, or `null` when it takes them all. */
	reads: string[] | null;
}

type Node = { type?: string; start?: number; [key: string]: unknown };

/** @prose
 * A component has browser behavior if its template has an event attribute with an expression
 * value, a `bind:`, a transition or animation, a `use:` action or `{@attach}`; if its script calls
 * `$effect` or `onMount` (resolved through its imports from `svelte`, so a renamed import counts);
 * if it imports a `.svelte.js` or `.svelte.ts` module that does; or if it passes an `on…` prop
 * with an expression value to a child component, since the function lives here. A string value is
 * data. The first found is the one a message names.
 */
export function analyze(file: string): Analysis {
	const source = readFileSync(file, 'utf8');
	const ast = parse(source, { modern: true }) as unknown as Record<string, Node | null>;
	const line = (node: Node) => source.slice(0, node.start ?? 0).split('\n').length;
	const found: Behavior[] = [];
	const add = (what: string, node: Node) => found.push({ what, line: line(node) });

	for (const node of nodes(ast.fragment)) {
		const element = isElement(node) ? `<${String(node.name)}>` : undefined;
		const child = isComponent(node) ? `<${String(node.name)}>` : undefined;
		const on = element ?? child ?? 'an element';
		for (const attribute of (node.attributes as Node[] | undefined) ?? []) {
			const directive = DIRECTIVES[attribute.type ?? '']?.(String(attribute.name));
			if (directive) add(`${directive} on ${on}`, attribute);
			if (attribute.type === 'Attribute' && isHandler(attribute)) {
				const name = String(attribute.name);
				if (element) add(`an ${name} handler on ${element}`, attribute);
				if (child) add(`${name} passed to ${child}`, attribute);
			}
		}
	}

	const svelteImports = new Map<string, string>();
	for (const script of [ast.module, ast.instance]) {
		for (const node of nodes(script?.content)) {
			if (node.type !== 'ImportDeclaration') continue;
			const from = String((node.source as Node).value);
			if (from === 'svelte') {
				for (const specifier of (node.specifiers as Node[]) ?? []) {
					const imported = (specifier.imported as Node | undefined)?.name as string | undefined;
					if (imported) svelteImports.set(String((specifier.local as Node).name), imported);
				}
			}
			if (/\.svelte\.[jt]s$/.test(from) && from.startsWith('.')) {
				const module = resolve(dirname(file), from);
				const call = callsIn(module);
				if (call) add(`${basename(module)}, which calls ${call}`, node);
			}
		}
		for (const node of nodes(script?.content)) {
			if (node.type !== 'CallExpression') continue;
			const name = calleeName(node.callee as Node);
			if (name === '$effect' || name === '$effect.pre') add(name, node);
			if (name && svelteImports.get(name) === 'onMount') add('onMount', node);
		}
	}

	const first = found.reduce<Behavior | undefined>(
		(a, b) => (a && a.line <= b.line ? a : b),
		undefined
	);
	return { behavior: first, reads: propsRead(ast.instance ?? null) };
}

// What each directive is called in a message, from its name: `bind:value`, `a transition`.
const DIRECTIVES: Record<string, (name: string) => string> = {
	BindDirective: (name) => `bind:${name}`,
	TransitionDirective: () => 'a transition',
	AnimateDirective: () => 'an animation',
	UseDirective: (name) => `use:${name}`,
	AttachTag: () => 'an {@attach}',
	OnDirective: (name) => `on:${name}`
};

/** `let { a, b } = $props()` reads `a` and `b`; `...rest` or `let props = $props()` reads all. */
function propsRead(instance: Node | null): string[] | null {
	for (const node of nodes(instance?.content)) {
		if (node.type !== 'VariableDeclarator') continue;
		const init = node.init as Node | null;
		if (init?.type !== 'CallExpression' || calleeName(init.callee as Node) !== '$props') continue;
		const id = node.id as Node;
		if (id.type !== 'ObjectPattern') return null;
		const names: string[] = [];
		for (const property of id.properties as Node[]) {
			if (property.type === 'RestElement') return null;
			const key = property.key as Node;
			if (key.type === 'Identifier') names.push(String(key.name));
		}
		return names;
	}
	return [];
}

/** A module's own `$effect` or `onMount`; one it imports in turn isn't followed. */
function callsIn(module: string): string | undefined {
	let text: string;
	try {
		text = readFileSync(module, 'utf8');
	} catch {
		return undefined;
	}
	return (
		/\$effect(?:\.pre)?(?=\s*\()/.exec(text)?.[0] ??
		(/\bonMount\s*\(/.test(text) ? 'onMount' : undefined)
	);
}

function isHandler(attribute: Node): boolean {
	if (!/^on[a-z]/.test(String(attribute.name)) || attribute.value === true) return false;
	const values = Array.isArray(attribute.value) ? attribute.value : [attribute.value];
	return values.some((value) => (value as Node).type === 'ExpressionTag');
}

function isElement(node: Node): boolean {
	return (
		node.type === 'RegularElement' ||
		node.type === 'SvelteElement' ||
		node.type === 'SvelteWindow' ||
		node.type === 'SvelteDocument' ||
		node.type === 'SvelteBody'
	);
}

function isComponent(node: Node): boolean {
	return node.type === 'Component' || node.type === 'SvelteComponent';
}

function calleeName(callee: Node): string | undefined {
	if (callee.type === 'Identifier') return String(callee.name);
	if (callee.type === 'MemberExpression') {
		const object = callee.object as Node;
		const property = callee.property as Node;
		if (object.type === 'Identifier' && property.type === 'Identifier') {
			return `${String(object.name)}.${String(property.name)}`;
		}
	}
	return undefined;
}

function* nodes(value: unknown): Generator<Node> {
	if (Array.isArray(value)) {
		for (const item of value) yield* nodes(item);
	} else if (value && typeof value === 'object') {
		const node = value as Node;
		if (typeof node.type === 'string') yield node;
		for (const [key, item] of Object.entries(node)) {
			if (key !== 'parent' && key !== 'metadata') yield* nodes(item);
		}
	}
}

/** @prose
 * A page or layout with browser behavior fails: it is what islands sit in, and making it one
 * would ship the whole page's JavaScript. The fix is always the same, so the message says it.
 */
export function checkNotIsland(file: string, kind: 'page' | 'layout'): void {
	const { behavior } = analyze(file);
	if (!behavior) return;
	throw new SiteError(
		file,
		`line ${behavior.line}: this ${kind} has browser behavior (${behavior.what}), but pages and layouts are HTML. Move that part into a component of its own in pattern/ and render it here: the component becomes the island.`
	);
}

/** @prose
 * What the site's islands are, filled as the server loads components: each island's marker name
 * and its file, which the client build imports.
 */
export type Islands = Map<string, string>;

const WRAP = '\0sitez-component:';
const WRAPPED = '.sitez.js';

/** @prose
 * In the server render, every `.svelte` a site's module imports resolves to a small module that
 * renders the real one through `component()` with what `analyze` found, and re-exports the rest
 * of it, so `<script module>` exports still work. The client build doesn't wrap anything: there
 * an island is just its component.
 */
export function islandModules(root: string, real: string, islands: Islands): Plugin {
	const server = join(runtime, 'server.ts');
	const pattern = join(real, 'pattern') + sep;
	const entryImporter = join(real, 'index.html');
	return {
		name: 'sitez:islands',
		enforce: 'pre',
		applyToEnvironment: (environment) => environment.name === 'ssr',
		async resolveId(id, importer, options) {
			// A page or layout the build loads itself has no importer, which Vite writes as this.
			if (!importer || importer === entryImporter) return null;
			if (importer.startsWith(WRAP) || importer.startsWith(runtime)) return null;
			if (!id.endsWith('.svelte')) return null;
			const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
			if (!resolved || resolved.external || !resolved.id.endsWith('.svelte')) return resolved;
			// Not ending in `.svelte`, which vite-plugin-svelte would compile.
			return `${WRAP}${resolved.id}${WRAPPED}`;
		},
		load(id) {
			if (!id.startsWith(WRAP)) return null;
			const file = id.slice(WRAP.length, -WRAPPED.length);
			const shown = asGiven(root, real, file);
			const { behavior, reads } = analyze(file);
			const name = file.startsWith(pattern)
				? posix(pattern, file).replace(/\.svelte$/, '')
				: packageName(file);
			if (behavior) {
				if (basename(file) === 'Layout.svelte') checkNotIsland(shown, 'layout');
				const known = islands.get(name);
				if (known && known !== file) {
					throw new SiteError(
						shown,
						`this island is named ${name}, as ${known} is. Rename one of them.`
					);
				}
				islands.set(name, file);
			}
			const info: Info = { name, file: shown, island: behavior !== undefined, reads };
			return [
				`import Component from ${JSON.stringify(file)};`,
				`import { component } from ${JSON.stringify(server)};`,
				`export * from ${JSON.stringify(file)};`,
				`const info = ${JSON.stringify(info)};`,
				'export default function Sitez(renderer, props) {',
				'\treturn component(renderer, props, Component, info);',
				'}'
			].join('\n');
		}
	};
}

/** A library's component is named from its path in its package: `bits-ui/Tabs`. */
function packageName(file: string): string {
	const parts = file.split(sep);
	const at = parts.lastIndexOf('node_modules');
	const rest = at === -1 ? parts.slice(-2) : parts.slice(at + 1);
	return rest.join('/').replace(/\.svelte$/, '');
}
