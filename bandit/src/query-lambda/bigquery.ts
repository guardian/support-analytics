import type { SimpleQueryRowsResponse} from "@google-cloud/bigquery";
import {BigQuery} from "@google-cloud/bigquery";
import {set, subHours} from "date-fns";
import type { BaseExternalAccountClient, ExternalAccountClientOptions } from 'google-auth-library';
import { ExternalAccountClient } from 'google-auth-library';
import type {Test} from "../lib/models";
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

export interface BigQueryResult{
	testName: string;
	channel: string;
	rows: SimpleQueryRowsResponse;
}
export const getDataForBanditTest = async (
	authClient: BaseExternalAccountClient,
	stage: 'CODE' | 'PROD',
	test: Test,
	date: Date = new Date(Date.now()),
): Promise<BigQueryResult> => {
	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});

	const end = set(date, { minutes: 0, seconds: 0, milliseconds: 0 });
	const start = subHours(end, 1);
	const testName = test.name;
	const channel = test.channel;
	const rows = await bigquery.query({query: buildQuery(test, 'PROD', start, end)});
	//stage is hardcoded to PROD above as we don't have sufficient data for page views in the CODE tables to run the query successfully
	return { testName,channel, rows };
}



