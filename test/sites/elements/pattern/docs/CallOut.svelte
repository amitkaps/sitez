<script>
	let { type = 'note', children } = $props();
</script>

<aside class="docs-call-out {type}">{@render children()}</aside>
