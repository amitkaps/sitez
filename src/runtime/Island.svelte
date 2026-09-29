<script>
	// An island with no children: the marker, and the component as the browser will hydrate it.
	import { setContext } from 'svelte';
	import { WHERE } from './server.ts';

	let { component: Component, name, p, props } = $props();
	setContext(WHERE, { island: name });
</script>

<sitez-island c={name} {p}><Component {...props} /></sitez-island>
