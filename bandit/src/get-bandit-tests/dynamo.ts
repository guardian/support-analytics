export function queryChannelTests(
	stage: string,
	docClient: AWS.DynamoDB.DocumentClient
) {
	return docClient
		.query({
			TableName: `support-admin-console-channel-tests-${stage.toUpperCase()}`,
			KeyConditionExpression: "channel = :channel",
			ExpressionAttributeNames: {
				"#status": "status",
			},
			ExpressionAttributeValues: {
				":channel": ["Epic","Banner1"],
				":draft": "Draft",
				":isBanditTest": true,
			},
			FilterExpression:
				"#status <> :draft AND isBanditTest = :isBanditTest",
		})
		.promise();
}
