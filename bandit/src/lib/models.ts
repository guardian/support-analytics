import type {QueryExecutionId} from "aws-sdk/clients/athena";

export interface QueryExecution {
	executionId: QueryExecutionId;
	testName: string;
}
