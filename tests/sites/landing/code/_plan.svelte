<script>
	// A module, by its `_`: imported by the page, never a page itself.
	let { plan } = $props();
</script>

<li>{plan.name}: {plan.price}.</li>
