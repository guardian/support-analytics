import * as AWS from "aws-sdk";

const stage = process.env.STAGE ?? "PROD";

const credentials =
	stage === "DEV"
		? new AWS.SharedIniFileCredentials({
				profile: process.env.AWS_PROFILE ?? "membership",
		  })
		: new AWS.ChainableTemporaryCredentials();

AWS.config.region = "eu-west-1";

export const config = {
	region: "eu-west-1",
	namespace: `support-bandit-${stage}`,
	stage,
	credentials,
};
