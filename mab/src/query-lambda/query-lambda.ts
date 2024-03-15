import * as AWS from 'aws-sdk';
import {getQueries, Test} from "./queries";
import {QueryExecution} from "../lib/models";
import {executeQuery} from "../lib/query";

const athena = new AWS.Athena({region: 'eu-west-1'});

const stage = process.env.Stage;
const athenaOutputBucket = process.env.AthenaOutputBucket ?? '';
const schemaName = 'acquisition';

const now = () => {
	const now = new Date();
	now.setMinutes(0);
	now.setSeconds(0);
	now.setMilliseconds(0);
	return now.toISOString()
}

// TODO - remove hour parameter and query for all data up to now
export async function run(tests: Test[], hour: string | undefined): Promise<QueryExecution[]> {
	const dateHourString = hour ?? now();
	if (stage !== 'CODE' && stage !== 'PROD') {
		return Promise.reject(`Invalid stage: ${stage}`);
	}

	const queries = getQueries(tests, dateHourString, stage);

	const results: Promise<QueryExecution>[] = queries.map(([test, query]) =>
		executeQuery(query, athenaOutputBucket, schemaName, athena)
			.then(executionId => ({ executionId, testName: test.name }))
	);

	return Promise.all(results)
}
