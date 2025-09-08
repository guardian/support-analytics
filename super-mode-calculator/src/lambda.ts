import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { SimpleQueryRowsResponse } from '@google-cloud/bigquery';
import { credentials, region } from './lib/aws/config';
import { buildAuthClient, getDataForSuperModeCalculator } from './lib/bigquery';
import {
	queryActiveArticlesForSuperMode,
	writeRowsForSuperMode,
} from './lib/dynamo';
import { getSSMParam } from './lib/ssm';
import type { QueryRow } from './parse';
import { parseResultFromBigQuery } from './parse';
import { isCurrentlyInSuperMode, shouldEnterSuperMode } from './superMode';

const stage = process.env.STAGE;
const docClient = DynamoDBDocumentClient.from(
	new DynamoDB({
		credentials: credentials(),
		region,
	}),
);

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
