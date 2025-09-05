import { getDynamoDbClient } from "../lib/aws/dynamodb";
import type { Test } from "../lib/models";
import type { QueryLambdaInput } from "../query-lambda/query-lambda";
import { queryChannelTests } from "./dynamo";

const STAGE: string = process.env.STAGE ?? "PROD";

const docClient = getDynamoDbClient();

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
	const tests = (await queryChannelTests(STAGE, docClient)).flatMap(
		(test) => test.Items ?? []
	) as Test[];
	const banditTests = filterBanditTests(tests);
	return {
		tests: banditTests,
	};
}
