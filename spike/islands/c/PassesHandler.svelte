<script>
	import Button from './Button.svelte';
	let n = $state(0);
</script>

<Button onclick={() => n++}>{n}</Button>
