<script>
	import Button from './Button.svelte';

	const props = { onclick: () => alert('hi') };
</script>

<h1>Spread</h1>

<Button {...props}>Say hi</Button>
