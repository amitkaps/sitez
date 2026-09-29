<script>
	let { page, children } = $props();
</script>

<article>
	{#if page.date}<p><time>{page.date}</time></p>{/if}
	{@render children()}
	<p><a href="/blog/">All posts</a></p>
</article>
