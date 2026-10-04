<script>
	let { format } = $props();
	let now = $state(new Date(0));
	$effect(() => {
		const timer = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(timer);
	});
</script>

<time>{format(now)}</time>
