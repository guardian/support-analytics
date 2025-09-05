import {
	type DynamoDBDocumentClient,
	QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const runQuery = (
	stage: string,
	docClient: DynamoDBDocumentClient,
	channel: string
) =>
	docClient.send(
		new QueryCommand({
			TableName: `support-admin-console-channel-tests-${stage.toUpperCase()}`,
			KeyConditionExpression: "channel = :channel",
			ExpressionAttributeNames: {
				"#status": "status",
			},
			ExpressionAttributeValues: {
				":channel": channel,
				":draft": "Draft",
			},
			FilterExpression: "#status <> :draft",
		})
	);
export function queryChannelTests(
	stage: string,
	docClient: DynamoDBDocumentClient
) {
	return Promise.all([
		runQuery(stage, docClient, "Epic"),
		runQuery(stage, docClient, "Banner1"),
		runQuery(stage, docClient, "Banner2"),
	]);
}
