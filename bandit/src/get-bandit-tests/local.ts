import * as AWS from "aws-sdk";
import type { ChannelDynamoRecord } from "./dynamo";
import { queryChannelTests } from "./dynamo";

const STAGE: string = process.env.Stage ?? "PROD";

const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });

queryChannelTests(STAGE, docClient)
	.then((tests) => {
		const rows = tests.Items as ChannelDynamoRecord[];
		console.log(rows.filter((r) => r.banditTest));
	})
	.catch((e) => console.log(e));
