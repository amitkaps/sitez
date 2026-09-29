<script>
	let { prose } = $props();
	let picked = $state('');
</script>

<select bind:value={picked}>
	{#each prose as p (p.url)}<option value={p.url}>{p.title}</option>{/each}
</select>
