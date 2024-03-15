import {
	GetQueryExecutionOutput, GetQueryResultsOutput,
	QueryExecutionId, QueryExecutionState,
	StartQueryExecutionInput,
} from "aws-sdk/clients/athena";
import * as AWS from 'aws-sdk';
import {QueryExecutionNotFoundError, QueryPendingError, QueryFailedError} from "./errors";

export class Query {
	query: string;
	token: string;

	constructor(q: string, name: string) {
		this.query = q;
		this.token = `${name}_${new Date().toISOString()}`;
	}
}

export function executeQuery(query: Query, athenaOutputBucket: string, schemaName: string, athena: AWS.Athena): Promise<QueryExecutionId> {
	const params: StartQueryExecutionInput = {
		QueryString: query.query,
		ResultConfiguration: {
			OutputLocation: `s3://${athenaOutputBucket}/mab-query-results/`,
		},
		ClientRequestToken: query.token,
		QueryExecutionContext: {
			Database: schemaName
		}
	};

	return athena
		.startQueryExecution(params)
		.promise()
		.then(result => result.QueryExecutionId as QueryExecutionId)
}

export function getExecutionState(
	executionId: string,
	athena: AWS.Athena,
): Promise<QueryExecutionState> {
	return athena
		.getQueryExecution({ QueryExecutionId: executionId })
		.promise()
		.then((getQueryExecutionOutput: GetQueryExecutionOutput) => {
			// console.log(
			// 	`Execution ${executionId} has status: ${JSON.stringify(
			// 		getQueryExecutionOutput,
			// 	)}`,
			// );

			const state = getQueryExecutionOutput.QueryExecution?.Status?.State;

			if (state === undefined) {
				return Promise.reject(new QueryExecutionNotFoundError());
			}

			return Promise.resolve(state);
		});
}

export function checkExecutionState(
	state: QueryExecutionState,
): Promise<QueryExecutionState> {
	if (state === 'QUEUED' || state === 'RUNNING')
		return Promise.reject(new QueryPendingError());
	else if (state === 'FAILED' || state === 'CANCELLED')
		return Promise.reject(new QueryFailedError());
	else return Promise.resolve(state);
}

export function getExecutionResult(
	executionId: string,
	athena: AWS.Athena,
): Promise<GetQueryResultsOutput> {
	return athena.getQueryResults({ QueryExecutionId: executionId }).promise();
}

export async function getCheckedExecutionResult(
	executionId: string,
	athena: AWS.Athena,
): Promise<GetQueryResultsOutput> {
	const state = await getExecutionState(executionId, athena);
	await checkExecutionState(state);
	return getExecutionResult(executionId, athena);
}
