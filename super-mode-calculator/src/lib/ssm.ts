import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';
import { credentials, region } from './aws/config';

export const getSSMParam = (
	key: string,
	stage: 'CODE' | 'PROD',
): Promise<string> => {
	console.log('Creating SSMClient');
	const ssm = new SSMClient({
		region,
		credentials: credentials(),
	});
	console.log('SSMClient created');

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
