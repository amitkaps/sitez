<script>
	import { fade } from 'svelte/transition';
	let { show = true } = $props();
</script>

{#if show}<p transition:fade>hi</p>{/if}
