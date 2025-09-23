import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

export const getSSMParam = (
	key: string,
	stage: 'CODE' | 'PROD',
): Promise<string> => {
	const ssm = new SSMClient({
		region: 'eu-west-1',
	});
	return ssm
		.send(
			new GetParameterCommand({
				Name: `/super-mode/${stage}/${key}`,
				WithDecryption: true,
			}),
		)
		.then((result) => {
			const value = result.Parameter?.Value;

			if (value) {
				return value;
			}

			throw new Error(
				`Failed to retrieve config from parameter store: ${key}`,
			);
		});
};
