import type { AWSError } from 'aws-sdk';
import type { DocumentClient } from 'aws-sdk/clients/dynamodb';
import type { PromiseResult } from 'aws-sdk/lib/request';
import { addDays, addHours } from 'date-fns';
import type { QueryRow } from '../lambdas/calculate/parse';
import { SUPER_MODE_DURATION_IN_HOURS } from './constants';
import { toDateHourString, toDateString } from './date';

export interface DynamoRecord extends QueryRow {
	id: string;
	startTimestamp: string;
	endDate: string;
	endTimestamp: string;
}

export function writeRowsForSuperMode(
	rows: QueryRow[],
	stage: string,
	docClient: DocumentClient,
): Promise<
	Array<PromiseResult<DocumentClient.BatchWriteItemOutput, AWSError>>
> {
	const batches = buildBatches(rows.map(buildWriteRequestForSuperMode));

	return Promise.all(
		batches.map((batch) => writeBatchForSuperMode(batch, stage, docClient)),
	);
}

function buildWriteRequestForSuperMode(
	row: QueryRow,
): DocumentClient.WriteRequest {
	return {
		PutRequest: {
			Item: buildDynamoRecord(row),
		},
	};
}

function buildDynamoRecord(
	row: QueryRow,
	now: Date = new Date(),
): DynamoRecord {
	const end = addHours(now, SUPER_MODE_DURATION_IN_HOURS);

	return {
		...row,
		id: `${row.region}_${Buffer.from(row.url).toString('base64')}`,
		startTimestamp: toDateHourString(now),
		endDate: toDateString(end),
		endTimestamp: toDateHourString(end),
	};
}

function writeBatchForSuperMode(
	batch: DocumentClient.WriteRequest[],
	stage: string,
	docClient: DocumentClient,
): Promise<PromiseResult<DocumentClient.BatchWriteItemOutput, AWSError>> {
	const table = `super-mode-calculator-${stage.toUpperCase()}`;

	return docClient
		.batchWrite({
			RequestItems: {
				[table]: batch,
			},
		})
		.promise();
}

const DYNAMO_MAX_BATCH_SIZE = 25;

function buildBatches<T>(
	records: T[],
	batchSize = DYNAMO_MAX_BATCH_SIZE,
): T[][] {
	const tmp = [...records];
	const batches = [];

	while (tmp.length) {
		batches.push(tmp.splice(0, batchSize));
	}

	return batches;
}

export async function queryActiveArticlesForSuperMode(
	stage: string,
	docClient: AWS.DynamoDB.DocumentClient,
	now: Date = new Date(),
): Promise<DynamoRecord[]> {
	const tomorrow = addDays(now, 1);

	const todayEndDate = toDateString(now);
	const tomorrowEndDate = toDateString(tomorrow);
	const endTimestamp = toDateHourString(now);

	const [todayResult, tomorrowResult] = await Promise.all([
		queryDateForSuperMode(todayEndDate, endTimestamp, stage, docClient),
		queryDateForSuperMode(tomorrowEndDate, endTimestamp, stage, docClient),
	]);

	return [
		...(todayResult.Items ?? []),
		...(tomorrowResult.Items ?? []),
	] as DynamoRecord[];
}

function queryDateForSuperMode(
	endDate: string,
	endTimestamp: string,
	stage: string,
	docClient: AWS.DynamoDB.DocumentClient,
) {
	return docClient
		.query({
			TableName: `super-mode-calculator-${stage.toUpperCase()}`,
			IndexName: 'end',
			KeyConditionExpression: 'endDate = :ed AND endTimestamp > :et ',
			ExpressionAttributeValues: {
				':ed': endDate,
				':et': endTimestamp,
			},
		})
		.promise();
}
