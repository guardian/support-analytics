import type { BatchWriteItemCommandInput } from "@aws-sdk/client-dynamodb";
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
	batch: unknown[],
	stage: string,
	docClient: DynamoDBDocumentClient
): Promise<BatchWriteCommandOutput> {
	const table = `support-bandit-${stage.toUpperCase()}`;

	// Build a typed request items object that can carry either document items (plain JS objects)
	// or AttributeValue maps; we type the inner arrays as `Record<string, unknown>` which is
	// sufficient for the DynamoDBDocumentClient at runtime while keeping TypeScript happy.
	// At runtime, `batch` will be either an array of low-level WriteRequest (AttributeValue maps)
	// or document-style write requests. The DynamoDBDocumentClient accepts document-style items.
	// We construct a RequestItems object and cast it to the expected type for the BatchWriteCommand.
	const request = {
		RequestItems: {
			[table]: batch,
		} as unknown as BatchWriteItemCommandInput["RequestItems"],
	} as BatchWriteItemCommandInput;

	return docClient.send(new BatchWriteCommand(request));
}
