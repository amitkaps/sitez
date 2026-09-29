<script>
	let { title, items = [] } = $props();
	let count = $state(0);
	const doubled = $derived(items.length * 2);
</script>

<h2>{title}</h2>
<ul>
	{#each items as i}<li>{i}</li>{/each}
</ul>
<p>{doubled} {count}</p>
<a href="/x">link</a>
