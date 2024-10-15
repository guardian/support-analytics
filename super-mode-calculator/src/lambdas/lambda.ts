const stage = process.env.STAGE;

export async function handler(): Promise<void> {
	if (stage !== 'CODE' && stage !== 'PROD') {
		return Promise.reject(`Invalid stage: ${stage ?? ''}`);
	}

	console.log('Simple Lambda');

	return;
}
