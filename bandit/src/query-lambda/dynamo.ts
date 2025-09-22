import type {
	BatchWriteCommandOutput,
	DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { VariantQueryRow } from "./parse-result";

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
	startTimestamp: string
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
	startTimestamp: string
): TestSample {
	const variants = rows.map((row) => ({
		variantName: row.variant_name,
		annualisedValueInGBP: row.sum_av_gbp,
		annualisedValueInGBPPerView: row.sum_av_gbp_per_view,
		views: row.views,
	}));

	return {
		testName: channel + "_" + testName,
		variants,
		timestamp: startTimestamp,
	};
}

export function writeBatch(
	batch: DocumentWriteRequest[],
	stage: string,
	docClient: DynamoDBDocumentClient
): Promise<BatchWriteCommandOutput> {
	const table = `support-bandit-${stage.toUpperCase()}`;

	return docClient.send(
		new BatchWriteCommand({
			RequestItems: {
				[table]: batch,
			},
		})
	);
}
