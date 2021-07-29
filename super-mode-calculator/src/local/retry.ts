export function retry<T>(f: () => Promise<T>, retries: number): Promise<T> {
	return f().catch((error) => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- ignore
		if (error.name === 'QueryPendingError' && retries > 0) {
			return delay(5_000).then(() => retry(f, retries - 1));
		}
		return Promise.reject(error);
	});
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}
