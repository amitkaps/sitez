<script module>
	export const metadata = { title: 'Blog' };
</script>

<script>
	import TagFilter from '../TagFilter.svelte';

	let { pages } = $props();
	const posts = pages
		.filter((p) => p.url.startsWith('/blog/') && p.date)
		.toSorted((a, b) => (a.date < b.date ? 1 : -1));
</script>

<h1>Blog</h1>

<TagFilter {posts} />
