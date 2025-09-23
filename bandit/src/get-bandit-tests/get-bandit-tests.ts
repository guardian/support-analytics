import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { region, stage } from "../lib/aws/config";
import type { Test } from "../lib/models";
import type { QueryLambdaInput } from "../query-lambda/query-lambda";
import { queryChannelTests } from "./dynamo";

const docClient = DynamoDBDocumentClient.from(new DynamoDB({ region }));

const filterBanditTests = (tests: Test[]): Test[] =>
	tests.filter(
		(test) =>
			!!test.methodologies?.find(
				(method) =>
					method.name === "EpsilonGreedyBandit" ||
					method.name === "Roulette"
			)
	);

export async function run(): Promise<QueryLambdaInput> {
	const tests = (await queryChannelTests(stage, docClient)).flatMap(
		(test) => test.Items ?? []
	) as Test[];
	const banditTests = filterBanditTests(tests);
	return {
		tests: banditTests,
	};
}
