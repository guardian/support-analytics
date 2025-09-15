import type { AWSError } from "aws-sdk";
import type { DocumentClient } from "aws-sdk/clients/dynamodb";
import type { PromiseResult } from "aws-sdk/lib/request";
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

export function buildWriteRequest(
	rows: VariantQueryRow[],
	testName: string,
	channel: string,
	startTimestamp: string
): DocumentClient.WriteRequest {
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
	batch: DocumentClient.WriteRequest[],
	stage: string,
	docClient: DocumentClient
): Promise<PromiseResult<DocumentClient.BatchWriteItemOutput, AWSError>> {
	const table = `support-bandit-${stage.toUpperCase()}`;

	return docClient
		.batchWrite({
			RequestItems: {
				[table]: batch,
			},
		})
		.promise();
}
