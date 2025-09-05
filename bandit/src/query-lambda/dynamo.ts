import type { WriteRequest } from "@aws-sdk/client-dynamodb";
import type {
	BatchWriteCommandOutput,
	DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import { BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { VariantQueryRow } from "./parse-result";

interface VariantSample {
	variantName: string;
	annualisedValueInGBP: number;
	annualisedValueInGBPPerView: number;
	views: number;
	totalViewsForComponentType?: number;
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
): WriteRequest {
	return {
		PutRequest: {
			Item: marshall(
				buildDynamoRecord(rows, testName, channel, startTimestamp)
			),
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
		totalViewsForComponentType: row.total_views_for_component_type,
	}));

	return {
		testName: channel + "_" + testName,
		variants,
		timestamp: startTimestamp,
	};
}

export function writeBatch(
	batch: WriteRequest[],
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
