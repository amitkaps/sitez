<script>
	let { prose, page } = $props();
</script>

<ul>
	{#each prose.filter((p) => p.url !== page.url) as p (p.url)}
		<li><a href={p.url}>{p.title}</a></li>
	{/each}
</ul>
