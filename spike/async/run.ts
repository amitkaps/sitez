import { render } from 'svelte/server';
import Page from './Page.svelte';
import Quality from './Quality.svelte';
import Broken from './Broken.svelte';

const page = { title: 'Quality', url: '/quality/' };

let t = performance.now();
const out = await render(Page, { props: { Page: Quality, page } });
console.log(`--- rendered in ${Math.round(performance.now() - t)} ms`);
console.log(out.body);
console.log('--- head:', JSON.stringify(out.head));

// Without await: does the sync path fail loudly, or return half a page?
try {
	const sync = render(Page, { props: { Page: Quality, page } });
	console.log('--- sync body:', sync.body);
} catch (error) {
	console.log('--- sync access throws:', (error as Error).message.split('\n')[0]);
}

// A failure while waiting: does it reject the render, and say where?
t = performance.now();
try {
	await render(Page, { props: { Page: Broken, page } });
	console.log('--- broken rendered?!');
} catch (error) {
	console.log('--- broken rejects:', (error as Error).message);
	console.log((error as Error).stack?.split('\n').slice(0, 6).join('\n'));
}

// Many pages at once, as a build would.
t = performance.now();
await Promise.all(
	Array.from({ length: 50 }, () => render(Page, { props: { Page: Quality, page } }))
);
console.log(`--- 50 pages in parallel: ${Math.round(performance.now() - t)} ms`);
