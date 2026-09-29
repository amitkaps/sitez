<script>
	// An island with children: the prose inside it stays HTML, and only the toggle hydrates.
	let { label = 'More', page, children } = $props();
	let open = $state(false);
</script>

<button onclick={() => (open = !open)} aria-expanded={open} title="{label} on {page.title}">
	{label}
</button>
<div hidden={!open}>{@render children()}</div>
