<script>
	import Button from './Button.svelte';
	const props = { onclick: () => alert('hi') };
</script>

<Button {...props}>Hi</Button>
