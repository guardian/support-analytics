import * as AWS from "aws-sdk";
import type { QueryExecution } from "../lib/models";
import { getCheckedExecutionResult } from "../lib/query";
import { buildWriteRequest, writeBatch } from "./dynamo";
import { parseResult } from "./parse";

const athena = new AWS.Athena({ region: "eu-west-1" });

const stage = process.env.STAGE ?? "PROD";
const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });

export async function run(events: QueryExecution[]): Promise<void> {
	const batches = await Promise.all(
		events.map(async (event) => {
			const executionId = event.executionId;
			const result = await getCheckedExecutionResult(executionId, athena);
			const rows = parseResult(result);
			return buildWriteRequest(rows, event.testName);
		})
	);

	await writeBatch(batches, stage, docClient);

	return;
}
