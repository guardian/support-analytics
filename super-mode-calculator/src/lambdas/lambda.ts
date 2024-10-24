import type { SimpleQueryRowsResponse } from '@google-cloud/bigquery';
import * as AWS from 'aws-sdk';
import {
	buildAuthClient,
	getDataForSuperModeCalculator,
} from '../lib/bigquery';
import {
	queryActiveArticlesForSuperMode,
	writeRowsForSuperMode,
} from '../lib/dynamoV2';
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

	const gcpConfig = await getSSMParam('gcp-wif-credentials-config', stage);
	const authClient = await buildAuthClient(gcpConfig);

	const rows: SimpleQueryRowsResponse = await getDataForSuperModeCalculator(
		authClient,
		stage,
	);

	const parsedResult: QueryRow[] = parseResultFromBigQuery(rows);

	const activeArticles = await queryActiveArticlesForSuperMode(
		stage,
		docClient,
	);
	const superModeRows = parsedResult.filter(
		(r) =>
			!isCurrentlyInSuperMode(r, activeArticles) &&
			shouldEnterSuperMode(r),
	);

	console.log({ superModeRows });

	await writeRowsForSuperMode(superModeRows, stage, docClient);

	return;
}
