import type {
	GetQueryExecutionOutput,
	GetQueryResultsOutput,
	QueryExecutionId,
	QueryExecutionState,
	StartQueryExecutionInput,
	StartQueryExecutionOutput,
} from 'aws-sdk/clients/athena';
import Athena = require('aws-sdk/clients/athena');
import {
	QueryExecutionNotFoundError,
	QueryFailedError,
	QueryPendingError,
} from './errors';

export class Query {
	query: string;
	token: string;

	constructor(q: string, name: string) {
		this.query = q;
		this.token = `${name}_${new Date().toISOString()}`;
	}
}

/**
 * Executes Athena queries and returns the execution IDs
 */
export function executeQueries(
	queries: Query[],
	stage: string,
	athenaOutputBucket: string,
	athenaOutputPath: string,
	schemaName: string,
	athena: Athena,
): Promise<QueryExecutionId[]> {
	const executeQuery = (query: Query): Promise<StartQueryExecutionOutput> => {
		console.log(`Starting execution of query:\n${query.query}`);

		const params: StartQueryExecutionInput = {
			QueryString: query.query,
			ResultConfiguration: {
				OutputLocation: `s3://${athenaOutputBucket}/${athenaOutputPath}/${stage}`,
			},
			ClientRequestToken: query.token,
			QueryExecutionContext: {
				Database: schemaName,
			},
		};

		return athena.startQueryExecution(params).promise();
	};

	return Promise.all(queries.map(executeQuery)).then(
		(results: StartQueryExecutionOutput[]) => {
			const ids = results.map((result) => result.QueryExecutionId);

			if (ids.some((id) => id === undefined)) {
				return Promise.reject('');
			}

			return Promise.resolve(ids as QueryExecutionId[]);
		},
	);
}

export function getExecutionState(
	executionId: string,
	athena: Athena,
): Promise<QueryExecutionState> {
	return athena
		.getQueryExecution({ QueryExecutionId: executionId })
		.promise()
		.then((getQueryExecutionOutput: GetQueryExecutionOutput) => {
			console.log(
				`Execution ${executionId} has status: ${JSON.stringify(
					getQueryExecutionOutput,
				)}`,
			);

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
	athena: Athena,
): Promise<GetQueryResultsOutput> {
	return athena.getQueryResults({ QueryExecutionId: executionId }).promise();
}

export async function getCheckedExecutionResult(
	executionId: string,
	athena: Athena,
): Promise<GetQueryResultsOutput> {
	const state = await getExecutionState(executionId, athena);
	await checkExecutionState(state);
	return getExecutionResult(executionId, athena);
}
