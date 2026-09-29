<script>
	import Island from './Island.svelte';
	import Tabs from './Tabs.svelte';

	const items = ['alpha', 'beta'];
</script>

<main>
	<p>Static before.</p>
	<Island component={Tabs} name="Tabs" labels={['One', 'Two']} since={new Date('2026-01-02')}>
		<h2>From a pattern</h2>
		{#each items as item}<p>{item}</p>{/each}
	</Island>
	<p>Static after.</p>
</main>
