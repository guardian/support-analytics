import * as AWS from "aws-sdk";
import { queryChannelTests } from "./dynamo";

const STAGE: string = process.env.Stage ?? "PROD";

const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });

queryChannelTests(STAGE, docClient)
	.then((tests) => {
		console.log(tests.Items);
	})
	.catch((e) => console.log(e));
