import * as AWS from "aws-sdk";
import { set, subHours } from "date-fns";
import type { QueryExecution, Test } from "../lib/models";
import { executeQuery } from "../lib/query";
import { getQueries } from "./queries";

const athena = new AWS.Athena({ region: "eu-west-1" });

const stage = process.env.STAGE;
const athenaOutputBucket = process.env.AthenaOutputBucket ?? "";
const schemaName = "acquisition";

export async function run(tests: Test[]): Promise<QueryExecution[]> {
	if (stage !== "CODE" && stage !== "PROD") {
		return Promise.reject(`Invalid stage: ${stage ?? ""}`);
	}

	const end = set(new Date(), { minutes: 0, seconds: 0, milliseconds: 0 });
	const start = subHours(end, 1);

	const queries = getQueries(tests, stage, start, end);

	const results: Array<Promise<QueryExecution>> = queries.map(
		([test, query]) =>
			executeQuery(query, athenaOutputBucket, schemaName, athena).then(
				(executionId) => ({
					executionId,
					testName: test.name,
					startTimestamp: start.toISOString(),
				})
			)
	);

	return Promise.all(results);
}
