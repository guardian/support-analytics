export interface ChannelDynamoRecord {
	channel: string;
	name: string;
	banditTest?: boolean;
}

export function queryChannelTests(
	stage: string,
	docClient: AWS.DynamoDB.DocumentClient
) {
	return docClient
		.query({
			TableName: `support-admin-console-channel-tests-${stage.toUpperCase()}`,
			KeyConditionExpression: "channel = :channel",
			ExpressionAttributeValues: {
				":channel": "Epic",
			},
		})
		.promise();
}
