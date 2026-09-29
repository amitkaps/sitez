import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vite-plus/test';
import { analyze } from './islands.ts';

const dir = mkdtempSync(join(tmpdir(), 'sitez-islands-'));

function component(source: string, name = 'C.svelte'): string {
	const file = join(dir, name);
	writeFileSync(file, source);
	return file;
}

describe('browser behavior', () => {
	test.each([
		['<button onclick={() => {}}>x</button>', 'an onclick handler on <button>'],
		['<script>let v = $state("");</script>\n<input bind:value={v} />', 'bind:value on <input>'],
		[
			'<script>import { fade } from "svelte/transition";</script>\n<p transition:fade>x</p>',
			'a transition on <p>'
		],
		[
			'<script>import { flip } from "svelte/animate";</script>\n{#each [1] as i (i)}<p animate:flip>{i}</p>{/each}',
			'an animation on <p>'
		],
		['<script>const go = () => {};</script>\n<p use:go>x</p>', 'use:go on <p>'],
		['<p {@attach (node) => {}}>x</p>', 'an {@attach} on <p>'],
		['<svelte:window onkeydown={() => {}} />', 'an onkeydown handler on <svelte:window>'],
		['<script>$effect(() => {});</script>', '$effect'],
		['<script>$effect.pre(() => {});</script>', '$effect.pre'],
		['<script>import { onMount as ready } from "svelte";\nready(() => {});</script>', 'onMount'],
		[
			'<script>import Button from "./Button.svelte";</script>\n<Button onclick={() => {}} />',
			'onclick passed to <Button>'
		]
	])('%s is %s', (source, what) => {
		expect(analyze(component(source)).behavior?.what).toBe(what);
	});

	test.each([
		['static markup', '<p>Hello</p>'],
		[
			'$state and $derived',
			'<script>let n = $state(1); const d = $derived(n * 2);</script>\n<p>{d}</p>'
		],
		['<details> and popover', '<details><summary>More</summary>x</details>\n<div popover>x</div>'],
		[
			'a string on… value, which is data',
			'<script>import Step from "./Step.svelte";</script>\n<Step onboarding="yes" />'
		],
		[
			'a spread onto an element',
			'<script>let rest = $props();</script>\n<button {...rest}>x</button>'
		],
		['a local function named onMount', '<script>function onMount() {}\nonMount();</script>']
	])('%s is none', (_, source) => {
		expect(analyze(component(source)).behavior).toBeUndefined();
	});

	test('an imported .svelte.ts module that calls $effect', () => {
		writeFileSync(join(dir, 'clock.svelte.ts'), 'export function clock() { $effect(() => {}); }\n');
		const file = component('<script>import { clock } from "./clock.svelte.ts";\nclock();</script>');
		expect(analyze(file).behavior?.what).toBe('clock.svelte.ts, which calls $effect');
	});

	test('the first behavior in the file is the one named, with its line', () => {
		const file = component('<p>x</p>\n<input bind:value={v} />\n<button onclick={f}>x</button>');
		expect(analyze(file).behavior).toEqual({ what: 'bind:value on <input>', line: 2 });
	});
});

describe('props read', () => {
	test.each([
		['<script>let { page, posts = [] } = $props();</script>', ['page', 'posts']],
		['<script>let { page, ...rest } = $props();</script>', null],
		['<script>let props = $props();</script>', null],
		['<p>No props</p>', []]
	])('%s', (source, reads) => {
		expect(analyze(component(source)).reads).toEqual(reads);
	});
});
