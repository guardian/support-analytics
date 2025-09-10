import type { SimpleQueryRowsResponse } from "@google-cloud/bigquery";
import { BigQuery } from "@google-cloud/bigquery";
import { addHours } from "date-fns";
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
import {
	mergeQueryResults,
	parseTestSpecificResult,
	parseTotalComponentViewsResult,
} from "./parse-result";
import type { TotalComponentViewsResult } from "./query-types";

// Memoization cache for total component views
const totalComponentViewsCache = new Map<string, TotalComponentViewsResult>();

export const clearTotalComponentViewsCache = (): void => {
	totalComponentViewsCache.clear();
};

export const buildAuthClient = (
	clientConfig: string
): Promise<BaseExternalAccountClient> =>
	new Promise((resolve, reject) => {
		console.log("buildAuthClient", { clientConfig });
		const parsedConfig = JSON.parse(
			clientConfig
		) as ExternalAccountClientOptions;
		const authClient = ExternalAccountClient.fromJSON(parsedConfig);
		if (!authClient) {
			console.log("Failed to create Google Auth Client", {
				clientConfig,
			});
			reject("Failed to create Google Auth Client");
			return;
		}

		console.log("Google Auth Client created", { authClient });
		resolve(authClient);
	});

export interface BigQueryResult {
	testName: string;
	channel: string;
	rows: SimpleQueryRowsResponse;
}

const createCacheKey = (
	channel: string,
	stage: string,
	start: Date,
	end: Date
): string => {
	return `${channel}-${stage}-${start.toISOString()}-${end.toISOString()}`;
};

const getTotalComponentViews = async (
	bigquery: BigQuery,
	channel: string,
	stage: "CODE" | "PROD",
	start: Date,
	end: Date
): Promise<TotalComponentViewsResult> => {
	const cacheKey = createCacheKey(channel, stage, start, end);

	const cachedResult = totalComponentViewsCache.get(cacheKey);
	if (cachedResult) {
		return cachedResult;
	}

	const query = buildTotalComponentViewsQuery(channel, stage, start, end);
	console.log("Running total component views query", {
		channel,
		stage,
		start: start.toISOString(),
		end: end.toISOString(),
	});
	const t0 = Date.now();
	const rows = await bigquery.query({ query });
	const t1 = Date.now();
	console.log("total component views query finished", {
		durationMs: t1 - t0,
	});
	const result = parseTotalComponentViewsResult(rows);

	totalComponentViewsCache.set(cacheKey, result);
	return result;
};

export const getDataForBanditTest = async (
	authClient: BaseExternalAccountClient,
	stage: "CODE" | "PROD",
	test: BanditTestConfig,
	start: Date
): Promise<BigQueryResult> => {
	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});

	const end = addHours(start, 1);
	const testName = test.name;
	const channel = test.channel;

	const [totalComponentViews, testSpecificQuery] = await Promise.all([
		getTotalComponentViews(bigquery, channel, "PROD", start, end),
		buildTestSpecificQuery(test, "PROD", start, end),
	]);

	console.log("Running test specific query", {
		testName,
		channel,
		testSpecificQuery,
	});

	const t2 = Date.now();
	const testSpecificRows = await bigquery.query({ query: testSpecificQuery });
	const t3 = Date.now();
	console.log("test specific query finished", {
		testName,
		durationMs: t3 - t2,
	});
	const testSpecificResults = parseTestSpecificResult(testSpecificRows);

	const mergedResults = mergeQueryResults(
		testSpecificResults,
		totalComponentViews
	);
	const rows: SimpleQueryRowsResponse = [
		mergedResults,
		{},
	] as SimpleQueryRowsResponse;

	//stage is hardcoded to PROD above as we don't have sufficient data for page views in the CODE tables to run the query successfully
	return { testName, channel, rows };
};
