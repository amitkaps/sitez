<script>
	// What Sitez puts in place of an island on the server: the marker, and the children rendered as
	// ordinary Svelte inside one element, so the client can hand them back as a raw snippet.
	import { stringify } from 'devalue';

	let { component: C, name, children, ...props } = $props();
</script>

<sitez-island c={name} p={stringify(props)}>
	{#if children}
		<C {...props}><sitez-children>{@render children()}</sitez-children></C>
	{:else}
		<C {...props} />
	{/if}
</sitez-island>
