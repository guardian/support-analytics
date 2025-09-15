import { BigQuery } from "@google-cloud/bigquery";
import type {
	BaseExternalAccountClient,
	ExternalAccountClientOptions,
} from "google-auth-library";
import { ExternalAccountClient } from "google-auth-library";
import type { BanditTestConfig } from "../lib/models";
import {
	buildTestSpecificQuery,
	buildTotalComponentViewsQuery,
} from "./build-query";
import type { VariantQueryRow
} from "./parse-result";
import {
	parseTotalComponentViewsResult,
	parseVariantQueryRows
} from "./parse-result";

export const buildAuthClient = (
	clientConfig: string
): Promise<BaseExternalAccountClient> =>
	new Promise((resolve, reject) => {
		const parsedConfig = JSON.parse(
			clientConfig
		) as ExternalAccountClientOptions;
		const authClient = ExternalAccountClient.fromJSON(parsedConfig);
		if (!authClient) {
			reject("Failed to create Google Auth Client");
			return;
		}
		resolve(authClient);
	});

export interface BigQueryResult {
	testName: string;
	channel: string;
	rows: VariantQueryRow[];
}

export const getTotalComponentViewsForChannels = async (
	authClient: BaseExternalAccountClient,
	channels: string[],
	stage: "CODE" | "PROD",
	start: Date,
	end: Date
): Promise<number> => {
	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});

	const query = buildTotalComponentViewsQuery(channels, stage, start, end);
	const rows = await bigquery.query({ query });
	const result = parseTotalComponentViewsResult(rows);

	return result.total_views;
};

export const getDataForBanditTest = async (
	authClient: BaseExternalAccountClient,
	stage: "CODE" | "PROD",
	test: BanditTestConfig,
	start: Date,
	end: Date,
): Promise<BigQueryResult> => {
	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});

	const testName = test.name;
	const channel = test.channel;

	const query = buildTestSpecificQuery(test, stage, start, end);
	console.log("Running test specific query: ", query);
	const bigQueryRows = await bigquery.query({ query });
	const rows = parseVariantQueryRows(bigQueryRows);

	return { testName, channel, rows };
};
