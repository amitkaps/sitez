<script>
	let { children } = $props();
	let open = $state(false);
</script>

<button onclick={() => (open = !open)}>More</button>
<div hidden={!open}>{@render children()}</div>
