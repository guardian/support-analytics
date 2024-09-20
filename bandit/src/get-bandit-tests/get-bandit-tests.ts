import * as AWS from "aws-sdk";
import type { Test } from "../lib/models";
import type { QueryLambdaInput } from "../query-lambda/query-lambda";
import { queryChannelTests } from "./dynamo";

const STAGE: string = process.env.STAGE ?? "PROD";

const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });

export async function run(): Promise<QueryLambdaInput> {
	const banditTests = await queryChannelTests(STAGE, docClient);
	const epicTests = banditTests[0].Items ?? [];
	const bannerTests = banditTests[1].Items ?? [];
	const tests = epicTests.concat(bannerTests);
	return {
		 tests: tests as Test[],
	};
}
