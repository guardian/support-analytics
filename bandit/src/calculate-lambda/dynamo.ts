import type { AWSError } from "aws-sdk";
import type { DocumentClient } from "aws-sdk/clients/dynamodb";
import type { PromiseResult } from "aws-sdk/lib/request";
import type { VariantQueryRow } from "./parse";

interface VariantModel {
	variantName: string;
	avGbpPerView: number;
}

export interface BanditModel {
	testName: string;
	variants: VariantModel[];
	// the start of the interval
	timestamp: string;
}

export function buildWriteRequest(
	rows: VariantQueryRow[],
	testName: string,
	startTimestamp: string
): DocumentClient.WriteRequest {
	return {
		PutRequest: {
			Item: buildDynamoRecord(rows, testName, startTimestamp),
		},
	};
}

function buildDynamoRecord(
	rows: VariantQueryRow[],
	testName: string,
	startTimestamp: string
): BanditModel {
	const variants = rows.map((row) => ({
		variantName: row.variantName,
		avGbpPerView: row.avGbpPerView,
	}));

	return {
		testName,
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
