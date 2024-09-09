import type {SimpleQueryRowsResponse} from "@google-cloud/bigquery";
import * as AWS from "aws-sdk";
import { set, subHours } from "date-fns";
import {buildWriteRequest} from "../calculate-lambda/dynamo";
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
  
	const client = await getSSMParam(ssmPath).then(buildAuthClient)
		// .then(authClient =>
		// 	banditTestingData(authClient, stage, input));

	const resultsFromBigQuery: Array<{testName: string; rows: SimpleQueryRowsResponse}> = await Promise.all(
		input.tests.map(test => getDataForBanditTest(client, stage, test, input.date))
	);

	const parsedResults = resultsFromBigQuery.map(({testName, rows}) => {
		const parsed = parseResultFromBigQuery(rows);
		return buildWriteRequest(parsed, testName, startTimestamp);
		// TODO - send request to dynamodb as batch
	});


	// const testNamesResult =  bigQueryData.map((data) => data.testName);
	// const variantResult =  bigQueryData.map((data) => data.rows);
	// console.log("bigQueryData", bigQueryData);
	// console.log("bigQueryData Testname Result", testNamesResult);
	// console.log("bigQueryData Variant Result", variantResult);
	//
	//
	// if (testNamesResult.length !== variantResult.length) {
	// 	throw new Error('Arrays must have the same length.');
	// }
	//
	// for (let i = 0; i < testNamesResult.length; i++) {
	// 	const testName = testNamesResult[i];
	// 	const variant= variantResult[i];
	// 	// const parsedVariant = parseResultFromBigQuery(variant);
	// 	// console.log("parsedVariantResult", parsedVariant);
	// 	//
	// 	console.log("Final Data", testName,variant,startTimestamp);
	// 	// buildWriteRequest(
	// 	// 	parsedVariant,
	// 	// 	testName,
	// 	// 	startTimestamp
	// 	// );
	//
	// }


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


