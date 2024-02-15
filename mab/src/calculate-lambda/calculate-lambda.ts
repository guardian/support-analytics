import {QueryExecutionId} from "aws-sdk/clients/athena";

export interface QueryExecution {
	executionId: QueryExecutionId;
	testName: string;
}

export async function run(events: QueryExecution[]): Promise<void> {
}
