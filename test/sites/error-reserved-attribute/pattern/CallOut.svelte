<script>
	let { type = 'note', title, children } = $props();
</script>

<aside class="call-out {type}">
	{#if title}<strong>{title}</strong>{/if}
	{@render children()}
</aside>
