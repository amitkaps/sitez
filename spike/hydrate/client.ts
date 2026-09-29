// Browser side: find the marker, rebuild props and children, hydrate, then click.
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

GlobalRegistrator.register();
document.body.innerHTML = readFileSync(join(import.meta.dirname, 'out.html'), 'utf8');

const { createRawSnippet, hydrate, flushSync } = await import('svelte');
const { parse } = await import('devalue');
const { default: Tabs } = await import('./Tabs.svelte');

const warnings: string[] = [];
const warn = console.warn;
console.warn = (...args) => (warnings.push(args.join(' ')), warn(...args));

const island = document.querySelector('sitez-island')!;
const kept = island.querySelector('sitez-children')!;
(kept as any).__marker = 'server node';

// The children are already in the DOM: hand the same HTML back, so hydration matches it.
const children = createRawSnippet(() => ({ render: () => kept.outerHTML }));
const props = parse(island.getAttribute('p')!);

hydrate(Tabs, { target: island, props: { ...props, children } });
flushSync();

const after = island.querySelector('sitez-children') as any;
console.log('since is a Date:', props.since instanceof Date);
console.log('children node reused:', after?.__marker === 'server node');
console.log('children HTML intact:', after?.innerHTML === kept.innerHTML);

(island.querySelectorAll('button')[1] as HTMLButtonElement).click();
flushSync();
console.log('clicked, data-active =', island.querySelector('.tabs')!.getAttribute('data-active'));
console.log(
	'aria-pressed:',
	[...island.querySelectorAll('button')].map((b) => b.getAttribute('aria-pressed')).join(',')
);
console.log(
	'page around the island untouched:',
	document.querySelector('main')!.firstElementChild!.textContent
);
console.log('hydration warnings:', warnings.length ? warnings : 'none');
await GlobalRegistrator.unregister();
