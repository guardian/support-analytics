export function queryChannelTests(
	stage: string,
	docClient: AWS.DynamoDB.DocumentClient
) {
	const epicTests= docClient
		.query({
			TableName: `support-admin-console-channel-tests-${stage.toUpperCase()}`,
			KeyConditionExpression: "channel = :channel",
			ExpressionAttributeNames: {
				"#status": "status",
			},
			ExpressionAttributeValues: {
				":channel": "Epic",
				":draft": "Draft",
				":isBanditTest": true,
			},
			FilterExpression:
				"#status <> :draft AND isBanditTest = :isBanditTest",
		})
		.promise();

	const bannerTests= docClient
		.query({
			TableName: `support-admin-console-channel-tests-${stage.toUpperCase()}`,
			KeyConditionExpression: "channel = :channel",
			ExpressionAttributeNames: {
				"#status": "status",
			},
			ExpressionAttributeValues: {
				":channel": "Banner1",
				":draft": "Draft",
				":isBanditTest": true,
			},
			FilterExpression:
				"#status <> :draft AND isBanditTest = :isBanditTest",
		})
		.promise();

	return Promise.all([epicTests, bannerTests]);

}
