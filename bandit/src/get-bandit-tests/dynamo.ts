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

	const banner1Tests= docClient
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
	const banner2Tests= docClient
		.query({
			TableName: `support-admin-console-channel-tests-${stage.toUpperCase()}`,
			KeyConditionExpression: "channel = :channel",
			ExpressionAttributeNames: {
				"#status": "status",
			},
			ExpressionAttributeValues: {
				":channel": "Banner2",
				":draft": "Draft",
				":isBanditTest": true,
			},
			FilterExpression:
				"#status <> :draft AND isBanditTest = :isBanditTest",
		})
		.promise();

	return Promise.all([epicTests, banner1Tests, banner2Tests]);

}
