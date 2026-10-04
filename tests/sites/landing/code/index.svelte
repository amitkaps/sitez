<script>
	import plans from "../data/plans.json";
	import Plan from "./_plan.svelte";

	let { site } = $props();
</script>

<h1>{site.name}</h1>

<p>A small tool that does one thing well.</p>

<details>
	<summary>How much does it cost?</summary>
	<ul>
		{#each plans as plan (plan.name)}<Plan {plan} />{/each}
	</ul>
</details>

<p><a href="/lantern.txt">Download</a></p>
