import * as AWS from 'aws-sdk';
import type { QueryExecutionId } from 'aws-sdk/clients/athena';
import { getCheckedExecutionResult } from '../../lib/query';
import { queryActiveArticles, writeRows } from './dynamo';
import { parseResult } from './parse';
import { isCurrentlyInSuperMode, shouldEnterSuperMode } from './superMode';

const STAGE: string = process.env.Stage ?? 'PROD';

const athena = new AWS.Athena({ region: 'eu-west-1' });
const docClient = new AWS.DynamoDB.DocumentClient({ region: 'eu-west-1' });

export async function handler(
	executionIds: QueryExecutionId[],
	dateTime: Date = new Date(),
): Promise<void> {
	const executionId = executionIds[0];
	const result = await getCheckedExecutionResult(executionId, athena);
	const rows = parseResult(result);

	console.log({ rows });

	const activeArticles = await queryActiveArticles(
		STAGE,
		docClient,
		dateTime,
	);
	const superModeRows = rows.filter(
		(r) =>
			!isCurrentlyInSuperMode(r, activeArticles) &&
			shouldEnterSuperMode(r),
	);

	console.log({ superModeRows });

	await writeRows(superModeRows, STAGE, docClient, dateTime);
}
