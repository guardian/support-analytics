import type { QueryExecutionId } from "aws-sdk/clients/athena";

export interface Test {
	name: string;
}

export interface QueryExecution {
	executionId: QueryExecutionId;
	testName: string;
	startTimestamp: string;
}
