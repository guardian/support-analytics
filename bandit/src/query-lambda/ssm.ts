import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { credentials, region } from "../lib/aws/config";

export const getSSMParam = (path: string): Promise<string> => {
	console.log("Creating SSMClient", { path });
	const ssm = new SSMClient({
		region,
		credentials: credentials(),
	});
	console.log("SSMClient created", { path });
	return ssm
		.send(
			new GetParameterCommand({
				Name: path,
				WithDecryption: true,
			})
		)
		.then((response) => {
			if (response.Parameter?.Value) {
				console.log("SSMClient Parameter Value", {
					path,
					value: response.Parameter.Value,
				});
				return response.Parameter.Value;
			} else {
				console.log("SSMClient Parameter not found", {
					path,
				});
				return Promise.reject(
					Error(`No parameter found for path ${path}`)
				);
			}
		});
};
