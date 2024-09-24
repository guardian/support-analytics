import * as AWS from "aws-sdk";
import { set, subHours } from "date-fns";
import type {  Test } from "../lib/models";
import type {BigQueryResult} from "./bigquery";
import { buildAuthClient, getDataForBanditTest} from "./bigquery";
import {buildWriteRequest, writeBatch} from "./dynamo";
import {parseResultFromBigQuery} from "./parse-result";
import {getSSMParam} from "./ssm";

const stage = process.env.STAGE;
const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });


export interface QueryLambdaInput {
	tests: Test[];
	date?: Date;
}

export async function run(input: QueryLambdaInput): Promise<void> {
	if (stage !== "CODE" && stage !== "PROD") {
		return Promise.reject(`Invalid stage: ${stage ?? ""}`);
	}

	const ssmPath = `/bandit-testing/${stage}/gcp-wif-credentials-config`;
	const date = input.date ?? new Date(Date.now());
	const end = set(date, { minutes: 0, seconds: 0, milliseconds: 0 });
	const start = subHours(end, 1);
	const startTimestamp = start.toISOString().replace("T", " ");
	const client = await getSSMParam(ssmPath).then(buildAuthClient);

	const resultsFromBigQuery: BigQueryResult[] = await Promise.all(
		input.tests.map(test => getDataForBanditTest(client, stage, test, input.date))
	);

	const writeRequests = resultsFromBigQuery.map(({testName,channel, rows}) => {
		const parsed = parseResultFromBigQuery(rows);
		return buildWriteRequest(parsed, testName,channel, startTimestamp);
	});
	if (writeRequests.length > 0) {
		await writeBatch(writeRequests, stage, docClient);
	} else {
		console.log("No data to write");
	}

	return;
}


