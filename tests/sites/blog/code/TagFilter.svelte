<script>
	let { posts } = $props();
	let tag = $state('');
	const tags = [...new Set(posts.flatMap((p) => p.tags ?? []))].sort();
	const shown = $derived(tag ? posts.filter((p) => p.tags?.includes(tag)) : posts);
</script>

<p>
	<button onclick={() => (tag = '')} aria-pressed={tag === ''}>All</button>
	{#each tags as t}
		<button onclick={() => (tag = t)} aria-pressed={tag === t}>{t}</button>
	{/each}
</p>

<ul>
	{#each shown as post}
		<li><a href={post.url}>{post.title}</a> <time>{post.date}</time></li>
	{/each}
</ul>
