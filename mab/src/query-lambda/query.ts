import {
	QueryExecutionId,
	StartQueryExecutionInput,
} from "aws-sdk/clients/athena";
import Athena = require("aws-sdk/clients/athena");

export class Query {
	query: string;
	token: string;

	constructor(q: string, name: string) {
		this.query = q;
		this.token = `${name}_${new Date().toISOString()}`;
	}
}

export function executeQuery(query: Query, athenaOutputBucket: string, schemaName: string, athena: Athena): Promise<QueryExecutionId> {
	const params: StartQueryExecutionInput = {
		QueryString: query.query,
		ResultConfiguration: {
			OutputLocation: `s3://${athenaOutputBucket}`,
		},
		ClientRequestToken: query.token,
		QueryExecutionContext: {
			Database: schemaName
		}
	};

	return athena
		.startQueryExecution(params)
		.promise()
		.then(result => result.QueryExecutionId)
}
