<script>
	let { children } = $props();
	let query = $state('');
</script>

<header><input bind:value={query} placeholder="Search" /></header>
<main>{@render children()}</main>
