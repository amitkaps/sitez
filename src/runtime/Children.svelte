<script>
	// An island's children are HTML: a component with browser behavior inside them can't hydrate.
	import { setContext } from 'svelte';
	import { WHERE } from './server.ts';

	let { name, children } = $props();
	setContext(WHERE, { childrenOf: name });
</script>

{@render children()}
