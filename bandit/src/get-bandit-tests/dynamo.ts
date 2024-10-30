const runQuery =(
	stage: string,
	docClient: AWS.DynamoDB.DocumentClient,
	channel: string,
	) =>
	 docClient
		.query({
			TableName: `support-admin-console-channel-tests-${stage.toUpperCase()}`,
			KeyConditionExpression: "channel = :channel",
			ExpressionAttributeNames: {
				"#status": "status",
			},
			ExpressionAttributeValues: {
				":channel":channel,
				":draft": "Draft",
			},
			FilterExpression:
				"#status <> :draft",
		})
		.promise();

export function queryChannelTests(
	stage: string,
	docClient: AWS.DynamoDB.DocumentClient
) {
	return Promise.all([runQuery(stage,docClient,"Epic"),runQuery(stage,docClient,"Banner1"), runQuery(stage,docClient,"Banner2")]);
}
