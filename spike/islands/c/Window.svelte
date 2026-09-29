<script>
	let y = $state(0);
</script>

<svelte:window bind:scrollY={y} onkeydown={() => {}} />
<p>{y}</p>
