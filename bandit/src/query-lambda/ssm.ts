import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { region } from "../lib/aws/config";

export const getSSMParam = (path: string): Promise<string> => {
	const ssm = new SSMClient({
		region,
	});
	return ssm
		.send(
			new GetParameterCommand({
				Name: path,
				WithDecryption: true,
			})
		)
		.then((response) => {
			if (response.Parameter?.Value) {
				return response.Parameter.Value;
			} else {
				return Promise.reject(
					Error(`No parameter found for path ${path}`)
				);
			}
		});
};
