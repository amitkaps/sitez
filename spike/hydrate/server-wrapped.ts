import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'svelte/server';
import Page from './Page.svelte';

const { body } = await render(Page);
writeFileSync(join(import.meta.dirname, 'out.html'), body);
console.log(body);
