import * as AWS from 'aws-sdk';
import {getQueries, Test} from "./queries";
import {QueryExecution} from "../calculate-lambda/calculate-lambda";
import {executeQuery} from "./query";

const athena = new AWS.Athena({region: 'eu-west-1'});

const stage = process.env.Stage;
const athenaOutputBucket = process.env.AthenaOutputBucket;
const schemaName = 'acquisition';

export async function run(tests: Test[]): Promise<QueryExecution[]> {
	if (stage !== 'CODE' && stage !== 'PROD') {
		return Promise.reject(`Invalid stage: ${stage}`);
	}

	const queries = getQueries(tests, stage);

	const results: Promise<QueryExecution>[] = queries.map(([test, query]) =>
		executeQuery(query, athenaOutputBucket, schemaName, athena)
			.then(executionId => ({ executionId, testName: test.name }))
	);

	return Promise.all(results)
}
