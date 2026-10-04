<script>
	import Card from './Card.svelte';

	let { children } = $props();
</script>

<main>{@render children()}</main>
<Card />
