<script>
	import { cases } from './cases.ts';

	const rows = await cases();
</script>

<p>{rows.length} cases</p>
