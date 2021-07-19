import * as AWS from 'aws-sdk';
import type { QueryExecutionId } from 'aws-sdk/clients/athena';
import { InvalidConfigError } from '../../lib/errors';
import {
	checkExecutionState,
	executeQueries,
	getExecutionState,
} from '../../lib/query';
import { getQuery } from './queries';

const athena = new AWS.Athena({ region: 'eu-west-1' });

interface Config {
	Stage: string;
	AthenaOutputBucket: string;
	AthenaOutputPath: string;
	SchemaName: string;
}

function getConfig(): Config | null {
	const Stage = process.env.Stage;
	const AthenaOutputBucket = process.env.AthenaOutputBucket;
	const AthenaOutputPath = 'super-mode-calculator-query';

	const SchemaName = process.env.SchemaName;

	if (!Stage || !AthenaOutputBucket || !SchemaName) {
		return null;
	}

	return {
		Stage,
		AthenaOutputBucket,
		AthenaOutputPath,
		SchemaName,
	};
}

export async function handler(
	executionIds: QueryExecutionId[],
): Promise<QueryExecutionId[]> {
	const config = getConfig();

	if (!config) {
		return Promise.reject(new InvalidConfigError());
	}

	const completionResults = await Promise.all(
		executionIds.map((id) => getExecutionState(id, athena)),
	);
	await Promise.all(completionResults.map(checkExecutionState));

	const query = getQuery(config.Stage);

	return executeQueries(
		[query],
		config.Stage,
		config.AthenaOutputBucket,
		config.AthenaOutputPath,
		config.SchemaName,
		athena,
	);
}
