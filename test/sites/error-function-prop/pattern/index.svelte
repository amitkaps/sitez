<script>
	import Clock from './Clock.svelte';
</script>

<h1>Time</h1>

<Clock format={(date) => date.toISOString()} />
