import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { VariantQueryRow } from './parse-result';

interface VariantSample {
	variantName: string;
	annualisedValueInGBP: number;
	annualisedValueInGBPPerView: number;
	views: number;
}

export interface TestSample {
	testName: string;
	variants: VariantSample[];
	// the start of the interval
	timestamp: string;
}

export type DocumentWriteRequest = { PutRequest: { Item: TestSample } };

export function buildWriteRequest(
	rows: VariantQueryRow[],
	testName: string,
	channel: string,
	startTimestamp: string,
): DocumentWriteRequest {
	return {
		PutRequest: {
			Item: buildDynamoRecord(rows, testName, channel, startTimestamp),
		},
	};
}

function buildDynamoRecord(
	rows: VariantQueryRow[],
	testName: string,
	channel: string,
	startTimestamp: string,
): TestSample {
	const variants = rows.map((row) => ({
		variantName: row.variant_name,
		annualisedValueInGBP: row.sum_av_gbp,
		annualisedValueInGBPPerView: row.sum_av_gbp_per_view,
		views: row.views,
	}));

	return {
		testName: channel + '_' + testName,
		variants,
		timestamp: startTimestamp,
	};
}

const CHUNK_SIZE = 25;

export async function write(
	batch: DocumentWriteRequest[],
	stage: string,
	docClient: DynamoDBDocumentClient,
): Promise<void> {
	const table = `support-bandit-${stage.toUpperCase()}`;
	for (let i = 0; i < batch.length; i += CHUNK_SIZE) {
		const chunk = batch.slice(i, i + CHUNK_SIZE);
		await docClient.send(
			new BatchWriteCommand({
				RequestItems: {
					[table]: chunk,
				},
			}),
		);
	}
}
