import { parse } from 'markz';
import { describe, expect, test } from 'vite-plus/test';
import { componentName, proseComponent } from './prose.ts';

const components: Record<string, string> = { 'call-out': '/site/pattern/CallOut.svelte' };
const svelte = (source: string) =>
	proseComponent('/site/prose/index.md', parse(source), (name) => components[name]);

describe('proseComponent', () => {
	test('is Markz HTML with its braces escaped', () => {
		expect(svelte('A {brace} and `${x}`.')).toBe(
			'<p>A &#123;brace&#125; and <code>$&#123;x&#125;</code>.</p>\n'
		);
	});

	test('renders an element with a component as that component', () => {
		expect(svelte('{@call-out type=note}\nBody.\n{/call-out}')).toBe(
			'<script>\n\timport CallOut from "/site/pattern/CallOut.svelte";\n' +
				'\tlet { page, prose, site } = $props();\n</script>\n\n' +
				'<CallOut {page} {prose} {site} type="note"><p>Body.</p>\n</CallOut>\n'
		);
	});

	test('fails on an attribute named like a prop every component gets', () => {
		expect(() => svelte('Intro.\n\n{@call-out prose=short /}')).toThrow(
			'line 3: {@call-out} has a prose attribute, but every component in prose already gets page, prose and site.'
		);
	});

	test('leaves an element with no component, and element syntax in code, as Markz writes them', () => {
		expect(svelte('{@chart-view data=a.csv /}\n\n`<call-out>`')).toBe(
			'<chart-view data="a.csv"></chart-view>\n<p><code>&lt;call-out&gt;</code></p>\n'
		);
	});

	test('does not rename an element whose name starts with a component name', () => {
		expect(svelte('{@call-out-box /}')).toBe('<call-out-box></call-out-box>\n');
	});

	test('writes raw HTML verbatim, never as Svelte', () => {
		const out = svelte('```=html\n<script>go("</script>")</script>\n<p>{x}</p>\n```');
		expect(out).toBe('{@html "<script>go(\\"<\\/script>\\")<\\/script>\\n<p>{x}<\\/p>\\n"}');
	});

	test('finds raw HTML inside containers', () => {
		expect(svelte('> ```=html\n> <b>x</b>\n> ```')).toBe(
			'<blockquote>\n{@html "<b>x<\\/b>\\n"}</blockquote>\n'
		);
	});
});

describe('componentName', () => {
	test('capitalizes each part of the element name', () => {
		expect(componentName('call-out')).toBe('CallOut');
		expect(componentName('chart-view-2d')).toBe('ChartView2d');
	});
});
