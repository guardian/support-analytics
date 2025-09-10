/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment -- for temporary testing purporses only */
import type { WriteRequest } from "@aws-sdk/client-dynamodb";
import { set, subHours } from "date-fns";
import { putMetric } from "../lib/aws/cloudwatch";
import { getDynamoDbClient } from "../lib/aws/dynamodb";
import type { BanditTestConfig, Methodology, Test } from "../lib/models";
import type { BigQueryResult } from "./bigquery";
import { buildAuthClient, getDataForBanditTest } from "./bigquery";
import type { TestSample } from "./dynamo";
import { buildWriteRequest, writeBatch } from "./dynamo";
import { parseResultFromBigQuery } from "./parse-result";
import { getSSMParam } from "./ssm";

const stage = process.env.STAGE;
const docClient = getDynamoDbClient();

export interface QueryLambdaInput {
	tests: Test[];
	date?: Date;
}

// Each test may contain 1 or more bandit methodologies
const getTestConfigs = (test: Test): BanditTestConfig[] => {
	const bandits: Methodology[] = (test.methodologies ?? []).filter(
		(method) =>
			method.name === "EpsilonGreedyBandit" || method.name === "Roulette"
	);
	return bandits.map((method) => ({
		name: method.testName ?? test.name,
		channel: test.channel,
	}));
};

export const putBanditTestMetrics = async (
	banditTestConfigs: BanditTestConfig[],
	writeRequests: WriteRequest[]
) => {
	const totalTests = banditTestConfigs.length;
	const testsWithData = writeRequests.filter((req) => {
		const item = req.PutRequest?.Item as TestSample | undefined;
		if (!item?.variants) {
			return false;
		}

		if (!Array.isArray(item.variants) || item.variants.length === 0) {
			return false;
		}

		return item.variants.some(
			(variant) =>
				variant.totalViewsForComponentType &&
				variant.totalViewsForComponentType > 0
		);
	}).length;

	const testsWithoutData = totalTests - testsWithData;

	console.log(
		JSON.stringify({
			message: "Calculating metrics for",
			banditTestConfigs,
			writeRequests,
		})
	);

	await Promise.all([
		putMetric("TotalBanditTests", totalTests),
		putMetric("TestsWithData", testsWithData),
		putMetric("TestsWithoutData", testsWithoutData),
	]).catch((error) => {
		console.error("Failed to send CloudWatch metrics:", String(error));
	});

	if (totalTests > 0) {
		const percentageWithoutData = (testsWithoutData / totalTests) * 100;
		await putMetric(
			"PercentageTestsWithoutData",
			percentageWithoutData,
			"Percent"
		).catch((error) => {
			console.error(
				"Failed to send percentage CloudWatch metric:",
				String(error)
			);
		});
	}
};

export async function run(input: QueryLambdaInput): Promise<void> {
	if (stage !== "CODE" && stage !== "PROD") {
		return Promise.reject(`Invalid stage: ${stage ?? ""}`);
	}

	const ssmPath = `/bandit-testing/${stage}/gcp-wif-credentials-config`;
	const date = input.date ?? new Date(Date.now());
	const currentHour = set(date, { minutes: 0, seconds: 0, milliseconds: 0 });
	/**
	 * Look back at the hour before last, to get a more complete set of events per hour.
	 * This is because component_events can arrive in the pageview table late.
	 */
	const start = subHours(currentHour, 2);
	const startTimestamp = start.toISOString().replace("T", " ");
	const clientConfig = await getSSMParam(ssmPath);
	console.log("buildAuthClient start", {
		clientConfig: clientConfig.slice(0, 200),
	});
	const client = await buildAuthClient(clientConfig);
	console.log("buildAuthClient returned");

	// Try to eagerly fetch an access token (if supported) with a short timeout so
	// we can detect stalls during token exchange early in the lambda invocation.
	try {
		// Some auth clients expose getAccessToken(); call if present.
		// Use a Promise.race to timeout diagnostics quickly.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- casting auth client to `any` to access optional `getAccessToken` method for a diagnostic runtime check
		const getAccessToken = (client as any).getAccessToken;
		if (typeof getAccessToken === "function") {
			const access = await Promise.race([
				getAccessToken.call(client),
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
			console.log("getAccessToken diagnostic result", {
				hasToken: !!access,
			});
		} else {
			console.log(
				"getAccessToken not available on auth client; skipping eager token check"
			);
		}
	} catch (err) {
		console.error("getAccessToken diagnostic failed:", String(err));
	}

	console.log("Flat mapping bandit test configs");
	const banditTestConfigs: BanditTestConfig[] = input.tests.flatMap((test) =>
		getTestConfigs(test)
	);

	console.log("Getting data from big query");
	const resultsFromBigQuery: BigQueryResult[] = await Promise.all(
		banditTestConfigs.map((test) =>
			// Wrap each BigQuery call with a diagnostic timeout so that slow or
			// hanging queries fail fast and produce a clear log entry.
			(async () => {
				console.log("getDataForBanditTest start", {
					testName: test.name,
					channel: test.channel,
				});
				try {
					const res = await Promise.race([
						getDataForBanditTest(client, stage, test, start),
						new Promise((_, reject) =>
							setTimeout(
								() =>
									reject(
										new Error(
											`getDataForBanditTest timeout for ${test.name}`
										)
									),
								20000
							)
						),
					]);
					console.log("getDataForBanditTest returned", {
						testName: test.name,
					});
					return res as BigQueryResult;
				} catch (err) {
					console.error("getDataForBanditTest failed", {
						testName: test.name,
						err: String(err),
					});
					throw err;
				}
			})()
		)
	);

	console.log("Creating write requests");

	const writeRequests = resultsFromBigQuery.map(
		({ testName, channel, rows }) => {
			const parsed = parseResultFromBigQuery(rows);
			console.log(
				JSON.stringify({
					message: `Writing row for ${testName}: `,
					parsed,
				})
			);
			return buildWriteRequest(parsed, testName, channel, startTimestamp);
		}
	);

	console.log("Put bandit test metrics");

	await putBanditTestMetrics(banditTestConfigs, writeRequests);

	if (writeRequests.length <= 0) {
		console.log("No data to write");
		return;
	}

	console.log("Write batch");

	await writeBatch(writeRequests, stage, docClient);

	console.log("Query lambda finished");
}
