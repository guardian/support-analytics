import * as AWS from "aws-sdk";
import type { Test } from "../lib/models";
import type { QueryLambdaInput } from "../query-lambda/query-lambda";
import { queryChannelTests } from "./dynamo";

const STAGE: string = process.env.STAGE ?? "PROD";

const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });

const filterBanditTests = (tests: Test[]): Test[] =>
	tests.filter(test => !!test.methodologies?.find((method) => method.name === 'EpsilonGreedyBandit'));

export async function run(): Promise<QueryLambdaInput> {
	const tests = (await queryChannelTests(STAGE, docClient)).flatMap(test => test.Items ?? []) as Test[];
	const banditTests = filterBanditTests(tests);
	return {
		 tests: banditTests,
	};
}
