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

// In-flight promises to deduplicate concurrent requests for the same key
const totalComponentViewsInFlight = new Map<
	string,
	Promise<TotalComponentViewsResult>
>();

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

export const getTotalComponentViews = async (
	bigquery: BigQuery,
	channel: string,
	stage: "CODE" | "PROD",
	start: Date,
	end: Date
): Promise<TotalComponentViewsResult> => {
	const cacheKey = createCacheKey(channel, stage, start, end);

	const cachedResult = totalComponentViewsCache.get(cacheKey);
	if (cachedResult) return cachedResult;

	const inFlight = totalComponentViewsInFlight.get(cacheKey);
	if (inFlight) return inFlight;

	const promise = (async () => {
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
		totalComponentViewsInFlight.delete(cacheKey);
		return result;
	})();

	totalComponentViewsInFlight.set(cacheKey, promise);
	return promise;
};

export const prefetchTotalsForChannels = async (
	authClient: BaseExternalAccountClient,
	channels: string[],
	start: Date,
	end: Date
): Promise<Record<string, TotalComponentViewsResult>> => {
	const totals: Record<string, TotalComponentViewsResult> = {};

	// DEBUG: try to get access token claims from the auth client so we can
	// identify which principal is used for prefetch. This helps diagnose
	// permission errors like "bigquery.jobs.create".
	try {
		const getAccessToken = (authClient as any).getAccessToken;
		if (typeof getAccessToken === "function") {
			const access = await Promise.race([
				getAccessToken.call(authClient),
				new Promise((_, reject) =>
					setTimeout(
						() =>
							reject(
								new Error("getAccessToken diagnostic timeout")
							),
						10000
					)
				),
			]);

			let token: string | undefined;
			if (access && typeof access === "object") token = access.token;
			if (!token && typeof access === "string") token = access;
			if (token) {
				try {
					const parts = token.split(".");
					if (parts.length >= 2) {
						const payload = JSON.parse(
							Buffer.from(parts[1], "base64").toString("utf8")
						);
						console.log("prefetch auth token claims", {
							principal: payload.email ?? payload.sub,
							aud: payload.aud,
							channelsPreview: channels.slice(0, 5),
						});
					} else {
						console.log("prefetch auth token: unexpected format");
					}
				} catch (e) {
					console.warn("prefetch token decode failed", String(e));
				}
			} else {
				console.log("prefetch getAccessToken did not return a token");
			}
		} else {
			console.log(
				"authClient.getAccessToken not available on authClient"
			);
		}
	} catch (err) {
		console.warn("prefetch getAccessToken diagnostic failed:", String(err));
	}

	// Use a single BigQuery instance to avoid multiple simultaneous auth
	// handshakes which can surface transient authentication errors.
	const bq = new BigQuery({
		projectId: `datatech-platform-prod`,
		authClient,
	});

	const promises = channels.map((channel) =>
		(async () => {
			try {
				return await getTotalComponentViews(
					bq,
					channel,
					"PROD",
					start,
					end
				);
			} catch (firstErr) {
				console.warn(
					"prefetchTotalsForChannels: first attempt failed, retrying",
					{
						channel,
						err: String(firstErr),
					}
				);
				// retry once
				return await getTotalComponentViews(
					bq,
					channel,
					"PROD",
					start,
					end
				);
			}
		})()
	);

	const results = await Promise.allSettled(promises);
	results.forEach((res, idx) => {
		const channel = channels[idx];
		if (res.status === "fulfilled") {
			totals[channel] = res.value;
		} else {
			console.error("prefetchTotalsForChannels: failed for channel", {
				channel,
				err: String(res.reason),
			});
		}
	});

	return totals;
};

export const getDataForBanditTest = async (
	authClient: BaseExternalAccountClient,
	stage: "CODE" | "PROD",
	test: BanditTestConfig,
	start: Date,
	totalsByChannel?: Record<string, TotalComponentViewsResult>
): Promise<BigQueryResult> => {
	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});

	const end = addHours(start, 1);
	const testName = test.name;
	const channel = test.channel;

	const testSpecificQuery = buildTestSpecificQuery(test, "PROD", start, end);

	let totalComponentViews: TotalComponentViewsResult | undefined =
		totalsByChannel?.[channel];

	if (!totalComponentViews) {
		totalComponentViews = await getTotalComponentViews(
			bigquery,
			channel,
			"PROD",
			start,
			end
		);
	}

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
