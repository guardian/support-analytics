import {BigQuery} from "@google-cloud/bigquery";
import {set, subHours} from "date-fns";
import type { BaseExternalAccountClient, ExternalAccountClientOptions } from 'google-auth-library';
import { ExternalAccountClient } from 'google-auth-library';
import type {QueryLambdaInput} from "./query-lambda";
import {buildQuery} from "./queryBigQueryData";

export const buildAuthClient = (clientConfig: string): Promise<BaseExternalAccountClient> => new Promise((resolve, reject) => {
	const parsedConfig = JSON.parse(clientConfig) as ExternalAccountClientOptions;
	const authClient = ExternalAccountClient.fromJSON(parsedConfig);
	if (authClient) {
		resolve(authClient);
	} else {
		reject('Failed to create Google Auth Client');
	}
});

export const banditTestingData = async (authClient: BaseExternalAccountClient, stage: 'CODE' | 'PROD',input: QueryLambdaInput)=> {
	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});

	const date = input.date ?? new Date(Date.now());
	const end = set(date, { minutes: 0, seconds: 0, milliseconds: 0 });
	const start = subHours(end, 1);
	const tests = input.tests;
	const promises = tests.map(async (test) => {
		const testName = test.name;
		const rows= await bigquery.query(buildQuery(test, stage, start, end));
		return { testName, rows };
	});

	return await Promise.all(promises);
}




