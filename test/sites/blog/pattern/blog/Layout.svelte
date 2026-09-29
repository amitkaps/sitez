<script>
	// Only the nearest layout wraps a page, so this one puts itself inside the site's.
	import Layout from '../Layout.svelte';

	let { page, prose, site, children } = $props();
</script>

<Layout {site}>
	<article>
		{#if page.date}<p><time>{page.date}</time></p>{/if}
		{@render children()}
		<p><a href="/blog/">All posts</a></p>
	</article>
</Layout>
