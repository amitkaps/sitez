<script>
	import { onMount } from 'svelte';
	let ready = $state(false);
	onMount(() => (ready = true));
</script>

<p>{ready}</p>
