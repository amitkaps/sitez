<script>
	// An island with data props and static children: the prose between {@tab-set} and {/tab-set}.
	let { labels, since, children } = $props();
	let active = $state(0);
</script>

<div class="tabs" data-active={active}>
	{#each labels as label, i}
		<button onclick={() => (active = i)} aria-pressed={active === i}>{label}</button>
	{/each}
	<p class="since">since {since.getFullYear()}</p>
	{@render children()}
</div>
