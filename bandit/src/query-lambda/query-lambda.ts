import * as AWS from "aws-sdk";
import type { WriteRequest } from "aws-sdk/clients/dynamodb";
import { set, subHours } from "date-fns";
import { putMetric } from "../lib/aws/cloudwatch";
import type { BanditTestConfig, Methodology, Test } from "../lib/models";
import type { BigQueryResult } from "./bigquery";
import { buildAuthClient, getDataForBanditTest } from "./bigquery";
import type { TestSample } from "./dynamo";
import { buildWriteRequest, writeBatch } from "./dynamo";
import { parseResultFromBigQuery } from "./parse-result";
import { getSSMParam } from "./ssm";

const stage = process.env.STAGE;
const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });

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
				variant.total_views_for_component_type &&
				variant.total_views_for_component_type > 0
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
		console.error("Failed to send CloudWatch metrics:", error);
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
				error
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
	const client = await getSSMParam(ssmPath).then(buildAuthClient);

	const banditTestConfigs: BanditTestConfig[] = input.tests.flatMap((test) =>
		getTestConfigs(test)
	);

	const resultsFromBigQuery: BigQueryResult[] = await Promise.all(
		banditTestConfigs.map((test) =>
			getDataForBanditTest(client, stage, test, start)
		)
	);

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

	await putBanditTestMetrics(banditTestConfigs, writeRequests);

	if (writeRequests.length <= 0) {
		console.log("No data to write");
		return;
	}

	await writeBatch(writeRequests, stage, docClient);
}
