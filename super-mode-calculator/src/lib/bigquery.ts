import type { SimpleQueryRowsResponse } from '@google-cloud/bigquery';
import { BigQuery } from '@google-cloud/bigquery';
import type {
	BaseExternalAccountClient,
	ExternalAccountClientOptions,
} from 'google-auth-library';
import { ExternalAccountClient } from 'google-auth-library';
import { buildQueryForSuperMode } from './build-query';

export const buildAuthClient = (
	clientConfig: string,
): Promise<BaseExternalAccountClient> =>
	new Promise((resolve, reject) => {
		const parsedConfig = JSON.parse(
			clientConfig,
		) as ExternalAccountClientOptions;
		const authClient = ExternalAccountClient.fromJSON(parsedConfig);
		if (authClient) {
			resolve(authClient);
		} else {
			reject('Failed to create Google Auth Client');
		}
	});

export const getDataForSuperModeCalculator = async (
	authClient: BaseExternalAccountClient,
	stage: 'CODE' | 'PROD',
): Promise<SimpleQueryRowsResponse> => {
	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});
	const query = buildQueryForSuperMode('PROD'); //stage is hardcoded to PROD above as we don't have sufficient data for page views in the CODE tables to run the query successfully
	console.log('Query:', query);
	const rows = await bigquery.query({ query });
	return rows;
};
