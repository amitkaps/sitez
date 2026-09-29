<script>
	let { type = 'note', children } = $props();
</script>

<aside class="call-out {type}">
	{@render children()}
</aside>

<style>
	.call-out {
		border-inline-start: 4px solid currentColor;
		padding-inline-start: 1rem;
	}
</style>
