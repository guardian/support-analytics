import type { SimpleQueryRowsResponse} from "@google-cloud/bigquery";
import {BigQuery} from "@google-cloud/bigquery";
import {addHours} from "date-fns";
import type { BaseExternalAccountClient, ExternalAccountClientOptions } from 'google-auth-library';
import { ExternalAccountClient } from 'google-auth-library';
import type {BanditTestConfig} from "../lib/models";
import {buildQuery} from "./build-query";

export const buildAuthClient = (clientConfig: string): Promise<BaseExternalAccountClient> => new Promise((resolve, reject) => {
	const parsedConfig = JSON.parse(clientConfig) as ExternalAccountClientOptions;
	const authClient = ExternalAccountClient.fromJSON(parsedConfig);
	if (authClient) {
		resolve(authClient);
	} else {
		reject('Failed to create Google Auth Client');
	}
});

export interface BigQueryResult {
	testName: string;
	channel: string;
	rows: SimpleQueryRowsResponse;
}

export const getDataForBanditTest = async (
	authClient: BaseExternalAccountClient,
	stage: 'CODE' | 'PROD',
	test: BanditTestConfig,
	start: Date,
): Promise<BigQueryResult> => {
	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});

	const end = addHours(start, 1);
	const testName = test.name;
	const channel = test.channel;
	const query = buildQuery(test, 'PROD', start, end);
	console.log('Running query: ', query);
	const rows = await bigquery.query({query});
	//stage is hardcoded to PROD above as we don't have sufficient data for page views in the CODE tables to run the query successfully
	return { testName,channel, rows };
}



