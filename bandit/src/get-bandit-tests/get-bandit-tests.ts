import * as AWS from "aws-sdk";
import type { Test } from "../lib/models";
import type { QueryLambdaInput } from "../query-lambda/query-lambda";
import { queryChannelTests } from "./dynamo";

const STAGE: string = process.env.STAGE ?? "PROD";

const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });

export async function run(): Promise<QueryLambdaInput> {
	const banditTests = await queryChannelTests(STAGE, docClient);
	const tests = banditTests.flatMap(test => test.Items ?? []);
	return {
		 tests: tests as Test[],
	};
}
