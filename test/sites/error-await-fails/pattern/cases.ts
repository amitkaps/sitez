export async function cases(): Promise<unknown[]> {
	await new Promise((resolve) => setTimeout(resolve, 5));
	throw new Error('test/cases.json not found');
}
