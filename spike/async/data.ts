// Stands in for the Markz test harness: slow, and only reachable at build time.
export async function quality(ms: number) {
	await new Promise((r) => setTimeout(r, ms));
	return {
		rows: [
			{ name: 'headings', pass: 12 },
			{ name: 'lists', pass: 9 }
		],
		ms
	};
}

export async function broken(): Promise<never> {
	await new Promise((r) => setTimeout(r, 5));
	throw new Error('harness failed: cases.ts not found');
}
