// Build side: render the island with its props and children, and wrap it in the marker.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { stringify } from 'devalue';
import Tabs from './Tabs.svelte';

// The children are prose Sitez already rendered to HTML. createRawSnippet needs one element,
// so Sitez wraps them in one.
const prose = '<h2>One</h2><p>First <em>tab</em>.</p><h2>Two</h2><p>Second.</p>';
const children = createRawSnippet(() => ({
	render: () => `<sitez-children>${prose}</sitez-children>`
}));

const props = { labels: ['One', 'Two'], since: new Date('2026-01-02') };
const { body } = await render(Tabs, { props: { ...props, children } });

// devalue's output is JavaScript-ish text; attribute-escape it.
const p = stringify(props).replaceAll('&', '&amp;').replaceAll("'", '&#39;');
const html = `<main><p>Static before.</p><sitez-island c="Tabs" p='${p}'>${body}</sitez-island><p>Static after.</p></main>`;
writeFileSync(join(import.meta.dirname, 'out.html'), html);
console.log(html);
