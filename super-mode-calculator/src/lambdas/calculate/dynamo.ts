import type { AWSError } from 'aws-sdk';
import type { DocumentClient } from 'aws-sdk/clients/dynamodb';
import type { PromiseResult } from 'aws-sdk/lib/request';
import { addDays, addHours } from 'date-fns';
import { SUPER_MODE_DURATION_IN_HOURS } from '../../lib/constants';
import { toDateHourString, toDateString } from '../../lib/date';
import type { QueryRow } from './parse';

export interface DynamoRecord extends QueryRow {
	id: string;
	startTimestamp: string;
	endDate: string;
	endTimestamp: string;
}

export function writeRows(
	rows: QueryRow[],
	stage: string,
	docClient: DocumentClient,
): Promise<
	Array<PromiseResult<DocumentClient.BatchWriteItemOutput, AWSError>>
> {
	const batches = buildBatches(rows.map(buildWriteRequest));

	return Promise.all(
		batches.map((batch) => writeBatch(batch, stage, docClient)),
	);
}

function buildWriteRequest(row: QueryRow): DocumentClient.WriteRequest {
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

function writeBatch(
	batch: DocumentClient.WriteRequest[],
	stage: string,
	docClient: DocumentClient,
): Promise<PromiseResult<DocumentClient.BatchWriteItemOutput, AWSError>> {
	const table = `super-mode-${stage.toUpperCase()}`;

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

export async function queryActiveArticles(
	stage: string,
	docClient: AWS.DynamoDB.DocumentClient,
	now: Date = new Date(),
): Promise<DynamoRecord[]> {
	const tomorrow = addDays(now, 1);

	const todayEndDate = toDateString(now);
	const tomorrowEndDate = toDateString(tomorrow);
	const endTimestamp = toDateHourString(now);

	const [todayResult, tomorrowResult] = await Promise.all([
		queryDate(todayEndDate, endTimestamp, stage, docClient),
		queryDate(tomorrowEndDate, endTimestamp, stage, docClient),
	]);

	return [
		...(todayResult.Items ?? []),
		...(tomorrowResult.Items ?? []),
	] as DynamoRecord[];
}

function queryDate(
	endDate: string,
	endTimestamp: string,
	stage: string,
	docClient: AWS.DynamoDB.DocumentClient,
) {
	return docClient
		.query({
			TableName: `super-mode-${stage.toUpperCase()}`,
			IndexName: 'end',
			KeyConditionExpression: 'endDate = :ed AND endTimestamp > :et ',
			ExpressionAttributeValues: {
				':ed': endDate,
				':et': endTimestamp,
			},
		})
		.promise();
}
