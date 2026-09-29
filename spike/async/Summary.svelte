<script>
	import { quality } from './data.ts';

	// A component below the page waits too, in parallel with the page's own await.
	const q = await quality(100);
</script>

<p class="summary">summary took {q.ms} ms</p>
