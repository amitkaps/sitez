<script>
	let { children } = $props();
	let liked = $state(false);
</script>

<button onclick={() => (liked = true)} aria-pressed={liked}>{@render children()}</button>
