import type { SimpleQueryRowsResponse } from '@google-cloud/bigquery';
import * as AWS from 'aws-sdk';
import {
	buildAuthClient,
	getDataForSuperModeCalculator,
} from '../lib/bigquery';
import { getSSMParam } from '../lib/ssm';
import { queryActiveArticles, writeRows } from './calculate/dynamo';
import type { QueryRow } from './calculate/parse';
import { parseResultFromBigQuery } from './calculate/parse';
import {
	isCurrentlyInSuperMode,
	shouldEnterSuperMode,
} from './calculate/superMode';

const stage = process.env.STAGE;
const docClient = new AWS.DynamoDB.DocumentClient({ region: 'eu-west-1' });

export async function handler(): Promise<void> {
	if (stage !== 'CODE' && stage !== 'PROD') {
		return Promise.reject(`Invalid stage: ${stage ?? ''}`);
	}

	console.log('Simple Lambda For Super mode calculator');

	const gcpConfig = await getSSMParam('gcp-wif-credentials-config', stage);
	const authClient = await buildAuthClient(gcpConfig);

	// const bigquery = new BigQuery({
	// 	projectId: `datatech-platform-${stage.toLowerCase()}`,
	// 	authClient,
	// });

	// const query =
	// 	'select * from `datatech-platform-prod.datalake.fact_acquisition_event` limit 10';
	// console.log('Running query: ', query);
	// const rows = await bigquery.query(query);
	const rows: SimpleQueryRowsResponse = await getDataForSuperModeCalculator(
		authClient,
		stage,
	);

	console.log('Query results: ', rows);

	const parsedResult: QueryRow[] = parseResultFromBigQuery(rows);

	console.log('Parsed result: ', parsedResult);

	const activeArticles = await queryActiveArticles(stage, docClient);
	const superModeRows = parsedResult.filter(
		(r) =>
			!isCurrentlyInSuperMode(r, activeArticles) &&
			shouldEnterSuperMode(r),
	);

	console.log({ superModeRows });

	await writeRows(superModeRows, stage, docClient);

	return;
}
