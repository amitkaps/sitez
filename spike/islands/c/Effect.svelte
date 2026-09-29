<script>
	let now = $state(0);
	$effect(() => {
		const id = setInterval(() => now++, 1000);
		return () => clearInterval(id);
	});
</script>

<p>{now}</p>
