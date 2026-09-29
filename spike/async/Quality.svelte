<script>
	import { quality } from './data.ts';
	import Summary from './Summary.svelte';

	let { page } = $props();
	const q = await quality(100);
</script>

<h1>{page.title}</h1>
<table>
	{#each q.rows as row}
		<tr><td>{row.name}</td><td>{row.pass}</td></tr>
	{/each}
</table>
<Summary />
<p>inline: {(await quality(50)).rows.length} rows</p>
