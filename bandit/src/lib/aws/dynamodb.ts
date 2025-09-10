import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { credentials, region } from "./config";

export const getDynamoDbClient = () => {
	const clientCredentials = credentials();
	console.log("Creating DynamoDB client", {
		region,
		credentials: clientCredentials,
	});
	const client = DynamoDBDocumentClient.from(
		new DynamoDB({
			credentials: clientCredentials,
			region,
		})
	);
	console.log("DynamoDB client created");
	return client;
};
