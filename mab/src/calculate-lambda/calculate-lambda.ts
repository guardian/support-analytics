import {QueryExecution} from "../lib/models";
import {getCheckedExecutionResult} from "../lib/query";
import * as AWS from "aws-sdk";
import {parseResult, QueryRow} from "./parse";

const athena = new AWS.Athena({region: 'eu-west-1'});

const stage = process.env.Stage;

export async function run(events: QueryExecution[]): Promise<QueryRow[]> {
	const executionId = events[0].executionId;
	const result = await getCheckedExecutionResult(executionId, athena);
	const rows = parseResult(result);

	// TODO - calculate AV/view and write to Dynamodb

	return rows;
}
