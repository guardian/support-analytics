import * as AWS from "aws-sdk";
import { set, subHours } from "date-fns";
import type { QueryExecution, Test } from "../lib/models";
import { executeQuery } from "../lib/query";
import {banditTestingData, buildAuthClient} from "./bigquery";
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

	const bigQueryData= await getSSMParam(ssmPath)
		.then(buildAuthClient)
		.then(authClient =>
			banditTestingData(authClient, stage, input));

	const result =  bigQueryData.map((data) => data.rows);
	const rows = parseResultFromBigQuery(result);

	console.log("bigQueryData", bigQueryData);
	console.log("bigQueryData Result", result);
	console.log("ParsedRows", rows);

	const date = input.date ?? new Date(Date.now());
	const end = set(date, { minutes: 0, seconds: 0, milliseconds: 0 });
	const start = subHours(end, 1);

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


