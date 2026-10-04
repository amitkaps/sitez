<script>
	let { pages } = $props();
	let picked = $state('');
</script>

<select bind:value={picked}>
	{#each pages as p (p.url)}<option value={p.url}>{p.title}</option>{/each}
</select>
