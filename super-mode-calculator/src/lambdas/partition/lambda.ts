import * as AWS from 'aws-sdk';
import type { QueryExecutionId } from 'aws-sdk/clients/athena';
import { InvalidConfigError } from '../../lib/errors';
import { executeQueries } from '../../lib/query';
import { getQueries } from './queries';

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
	const AthenaOutputPath = 'super-mode-calculator-partition';
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

export async function handler(): Promise<QueryExecutionId[]> {
	const config = getConfig();

	if (!config) {
		return Promise.reject(new InvalidConfigError());
	}

	const queries = getQueries(config.Stage);

	return executeQueries(
		queries,
		config.Stage,
		config.AthenaOutputBucket,
		config.AthenaOutputPath,
		config.SchemaName,
		athena,
	);
}
