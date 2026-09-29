<script>
	let { page, children } = $props();
</script>

<header>{page.title}</header>
<main>{@render children()}</main>
