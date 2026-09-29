<script>
	// Forwards everything, handlers included, to the button: interactive only if given one.
	let { children, ...rest } = $props();
</script>

<button {...rest}>{@render children?.()}</button>
