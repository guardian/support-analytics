import type {SimpleQueryRowsResponse} from "@google-cloud/bigquery";
import * as AWS from "aws-sdk";
import { set, subHours } from "date-fns";
import {buildWriteRequest, writeBatch} from "../calculate-lambda/dynamo";
import type { QueryExecution, Test } from "../lib/models";
import { executeQuery } from "../lib/query";
import { buildAuthClient, getDataForBanditTest} from "./bigquery";
import {parseResultFromBigQuery} from "./parseResult";
import { getQueries } from "./queries";
import {getSSMParam} from "./ssm";

const athena = new AWS.Athena({ region: "eu-west-1" });

const stage = process.env.STAGE;
const athenaOutputBucket = process.env.AthenaOutputBucket ?? "";
const schemaName = "acquisition";
const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });


export interface QueryLambdaInput {
	tests: Test[];
	date?: Date;
}

export async function run(input: QueryLambdaInput): Promise<QueryExecution[]> {
	if (stage !== "CODE" && stage !== "PROD") {
		return Promise.reject(`Invalid stage: ${stage ?? ""}`);
	}

	const ssmPath = `/bandit-testing/${stage}/gcp-wif-credentials-config`;
	const date = input.date ?? new Date(Date.now());
	const end = set(date, { minutes: 0, seconds: 0, milliseconds: 0 });
	const start = subHours(end, 1);
	const startTimestamp = start.toISOString().replace("T", " ");
<<<<<<< HEAD
	const client = await getSSMParam(ssmPath).then(buildAuthClient)
		// .then(authClient =>
		// 	banditTestingData(authClient, stage, input));
=======

	const client = await getSSMParam(ssmPath).then(buildAuthClient);
>>>>>>> ac928a8 (Remove unwanted console statements)

	const resultsFromBigQuery: Array<{testName: string; rows: SimpleQueryRowsResponse}> = await Promise.all(
		input.tests.map(test => getDataForBanditTest(client, stage, test, input.date))
	);

	const parsedResults = resultsFromBigQuery.map(({testName, rows}) => {
		const parsed = parseResultFromBigQuery(rows);
		return buildWriteRequest(parsed, testName, startTimestamp);
		// TODO - send request to dynamodb as batch
	});
<<<<<<< HEAD
=======

<<<<<<< HEAD
>>>>>>> ac928a8 (Remove unwanted console statements)
	console.log("Parsed results: ", parsedResults);
=======
	const batches = await Promise.all(parsedResults);
	console.log("Parsed results: ", batches);

	if (batches.length > 0) {
		await writeBatch(batches, stage, docClient);
	} else {
		console.log("No data to write");
	}
>>>>>>> 7eccf20 (Write to DynamoDB)

	const queries = getQueries(input.tests, stage, start, end);

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


