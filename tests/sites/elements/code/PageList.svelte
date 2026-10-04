<script>
	let { pages, page } = $props();
</script>

<ul>
	{#each pages.filter((p) => p.url !== page.url) as p (p.url)}
		<li><a href={p.url}>{p.title}</a></li>
	{/each}
</ul>
