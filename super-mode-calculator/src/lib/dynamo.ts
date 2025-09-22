import type {
	BatchWriteCommandOutput,
	DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { addDays, addHours } from 'date-fns';
import { SUPER_MODE_DURATION_IN_HOURS } from './constants';
import { toDateHourString, toDateString } from './date';
import type { QueryRow } from '../parse';

export interface DynamoRecord extends QueryRow {
	id: string;
	startTimestamp: string;
	endDate: string;
	endTimestamp: string;
}

export function writeRowsForSuperMode(
	rows: QueryRow[],
	stage: string,
	docClient: DynamoDBDocumentClient,
): Promise<BatchWriteCommandOutput[]> {
	const batches = buildBatches(rows.map(buildWriteRequestForSuperMode));

	return Promise.all(
		batches.map((batch) => writeBatchForSuperMode(batch, stage, docClient)),
	);
}

export type DocumentWriteRequest = { PutRequest: { Item: DynamoRecord } };

function buildWriteRequestForSuperMode(row: QueryRow): DocumentWriteRequest {
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
	batch: DocumentWriteRequest[],
	stage: string,
	docClient: DynamoDBDocumentClient,
): Promise<BatchWriteCommandOutput> {
	const table = `super-mode-calculator-${stage.toUpperCase()}`;

	return docClient.send(
		new BatchWriteCommand({
			RequestItems: {
				[table]: batch,
			},
		}),
	);
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
	docClient: DynamoDBDocumentClient,
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
	docClient: DynamoDBDocumentClient,
) {
	return docClient.send(
		new QueryCommand({
			TableName: `super-mode-calculator-${stage.toUpperCase()}`,
			IndexName: 'end',
			KeyConditionExpression: 'endDate = :ed AND endTimestamp > :et ',
			ExpressionAttributeValues: {
				':ed': endDate,
				':et': endTimestamp,
			},
		}),
	);
}
