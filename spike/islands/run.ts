// For each component: the browser-behavior signals in its compiled client code, and in its AST.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compile, parse } from 'svelte/compiler';

const dir = join(import.meta.dirname, 'c');

// Runtime calls that only mean something in a browser.
const runtime =
	/\$\.(event|delegate|delegated|bind_\w+|transition|animation|attach|action|user_effect|user_pre_effect)\b|\bonMount\b|\.__(click|input|keydown)\b/g;

function compiled(source: string, filename: string): string[] {
	const { js } = compile(source, { filename, generate: 'client' });
	return [...new Set([...js.code.matchAll(runtime)].map((m) => m[0]))];
}

type Node = { type?: string; [key: string]: unknown };

function* nodes(value: unknown): Generator<Node> {
	if (Array.isArray(value)) for (const v of value) yield* nodes(v);
	else if (value && typeof value === 'object') {
		const node = value as Node;
		if (typeof node.type === 'string') yield node;
		for (const [key, v] of Object.entries(node)) if (key !== 'parent') yield* nodes(v);
	}
}

const isEventName = (name: string) => /^on[a-z]/.test(name);

function fromAst(source: string): string[] {
	const ast = parse(source, { modern: true });
	const found = new Set<string>();
	for (const n of nodes(ast.fragment)) {
		const isElement =
			n.type === 'RegularElement' ||
			n.type === 'SvelteWindow' ||
			n.type === 'SvelteDocument' ||
			n.type === 'SvelteBody' ||
			n.type === 'SvelteElement';
		const isComponent = n.type === 'Component' || n.type === 'SvelteComponent';
		for (const a of (n.attributes as Node[] | undefined) ?? []) {
			if (a.type === 'BindDirective') found.add('bind:');
			if (a.type === 'TransitionDirective') found.add('transition');
			if (a.type === 'AnimateDirective') found.add('animate');
			if (a.type === 'UseDirective') found.add('use:');
			if (a.type === 'AttachTag') found.add('{@attach}');
			if (a.type === 'OnDirective') found.add('on: (legacy)');
			if (a.type === 'Attribute' && isEventName(a.name as string) && a.value !== true) {
				// `onclick={fn}` is an ExpressionTag; `onclick="text"` is Text.
				const value = Array.isArray(a.value) ? a.value : [a.value];
				const expression = value.some((v) => (v as Node).type === 'ExpressionTag');
				if (isElement) found.add(expression ? 'event attribute' : 'inline string handler');
				if (isComponent && expression) found.add(`on… prop to <${String(n.name)}>`);
			}
			if (a.type === 'SpreadAttribute' && isComponent)
				found.add(`spread to <${String(n.name)}> (check at build)`);
		}
	}
	for (const n of nodes(ast.instance)) {
		if (n.type === 'CallExpression') {
			const callee = n.callee as Node;
			const name =
				callee.type === 'Identifier'
					? callee.name
					: callee.type === 'MemberExpression'
						? `${String((callee.object as Node).name)}.${String((callee.property as Node).name)}`
						: '';
			if (typeof name === 'string' && /^\$effect(\.pre)?$|^onMount$/.test(name)) found.add(name);
		}
	}
	return [...found];
}

for (const file of readdirSync(dir).sort()) {
	const source = readFileSync(join(dir, file), 'utf8');
	const a = compiled(source, file);
	const b = fromAst(source);
	console.log(`${file.padEnd(22)} compiled: ${a.join(' ') || '—'}`);
	console.log(`${''.padEnd(22)} ast:      ${b.join(', ') || '—'}`);
}
