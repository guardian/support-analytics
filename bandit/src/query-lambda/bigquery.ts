import type { SimpleQueryRowsResponse} from "@google-cloud/bigquery";
import {BigQuery} from "@google-cloud/bigquery";
import type { Query } from "@google-cloud/bigquery/build/src/bigquery";
import type { BaseExternalAccountClient, ExternalAccountClientOptions } from 'google-auth-library';
import { ExternalAccountClient } from 'google-auth-library';

export const buildAuthClient = (clientConfig: string): Promise<BaseExternalAccountClient> => new Promise((resolve, reject) => {
	const parsedConfig = JSON.parse(clientConfig) as ExternalAccountClientOptions;
	const authClient = ExternalAccountClient.fromJSON(parsedConfig);
	console.log("Step 2")
	if (authClient) {
		resolve(authClient);
	} else {
		reject('Failed to create Google Auth Client');
	}
});

export const banditTestingData = (authClient: BaseExternalAccountClient, stage: 'CODE' | 'PROD'):Promise<SimpleQueryRowsResponse> => {
	console.log("Step 3")
	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});

	const query: Query = {
		query: 'SELECT * FROM online_traffic.fact_page_view  where received_date >= "2024-03-15" LIMIT 10',
	}

	console.log("Step 3-bigquery ",bigquery);
	console.log("Step 3-query ",query);
	console.log("Step 3-result ",bigquery.query(query));

	return bigquery.query(query);
}
