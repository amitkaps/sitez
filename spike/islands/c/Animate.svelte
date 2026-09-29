<script>
	import { flip } from 'svelte/animate';
	let { items = [] } = $props();
</script>

{#each items as i (i)}<li animate:flip>{i}</li>{/each}
