import * as AWS from 'aws-sdk';

export const getSSMParam = (path: string): Promise<string> => {
	const ssm = new AWS.SSM({ region: 'eu-west-1' });
	return ssm
		.getParameter({
			Name: path,
			WithDecryption: true,
		})
		.promise()
		.then(response => {
			if (response.Parameter?.Value) {
				return response.Parameter.Value;
			} else {
				return Promise.reject(Error(`No parameter found for path ${path}`));
			}
		});
}
