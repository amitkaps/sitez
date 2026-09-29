<script>
	import Layout from './Layout.svelte';

	// How Sitez will render a page: the layout, with the page as its children.
	let { Page, page } = $props();
</script>

<Layout {page}>
	<Page {page} />
</Layout>
