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
	startTimestamp: string;
}

export function buildWriteRequest(
	rows: VariantQueryRow[],
	testName: string,
	start: Date
): DocumentClient.WriteRequest {
	return {
		PutRequest: {
			Item: buildDynamoRecord(rows, testName, start),
		},
	};
}

function buildDynamoRecord(
	rows: VariantQueryRow[],
	testName: string,
	start: Date
): BanditModel {
	const variants = rows.map((row) => ({
		variantName: row.variantName,
		avGbpPerView: row.avGbpPerView,
	}));

	return {
		testName,
		variants,
		startTimestamp: start.toISOString(),
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
