import { DynamoDB } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { addHours, set, subHours } from "date-fns";
import { putMetric } from "../lib/aws/cloudwatch";
import { region } from "../lib/aws/config";
import type { BanditTestConfig, Methodology, Test } from "../lib/models";
import type { BigQueryResult } from "./bigquery";
import {
	buildAuthClient,
	getDataForBanditTest,
	getTotalComponentViewsForChannels,
} from "./bigquery";
import { buildWriteRequest, writeBatch } from "./dynamo";
import { getSSMParam } from "./ssm";

const stage = process.env.STAGE;
const docClient = DynamoDBDocumentClient.from(new DynamoDB({ region }));

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
	testsData: BigQueryResult[]
): Promise<void> => {
	const totalTests = testsData.length;

	const testsWithVariantData = testsData.filter(
		(test) => test.rows.length > 0
	).length;

	await Promise.all([
		putMetric("TotalBanditTests", totalTests),
		putMetric("TestsWithVariantData", testsWithVariantData),
	]).catch((error) => {
		console.error("Failed to send CloudWatch metrics:", String(error));
	});
};

const getTotalVariantViews = (testsData: BigQueryResult[]): number => {
	return testsData.reduce(
		(sum, test) =>
			sum +
			test.rows.reduce((testSum, variant) => testSum + variant.views, 0),
		0
	);
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
	const end = addHours(start, 1);
	const client = await getSSMParam(ssmPath).then(buildAuthClient);

	const banditTestConfigs: BanditTestConfig[] = input.tests.flatMap((test) =>
		getTestConfigs(test)
	);

	const resultsFromBigQuery: BigQueryResult[] = await Promise.all(
		banditTestConfigs.map((test) =>
			getDataForBanditTest(client, stage, test, start, end)
		)
	);

	const writeRequests = resultsFromBigQuery.map(
		({ testName, channel, rows }) => {
			console.log(
				JSON.stringify({
					message: `Writing row for ${testName}: `,
					rows,
				})
			);
			return buildWriteRequest(rows, testName, channel, startTimestamp);
		}
	);

	const totalVariantViews = getTotalVariantViews(resultsFromBigQuery);

	if (banditTestConfigs.length > 0 && totalVariantViews === 0) {
		/**
		 * None of the bandit tests have any impressions for the queried window.
		 * This can happen if other tests have been given higher priority.
		 * But it could also be because of an upstream data issue. Here we query for total views across all channels, to check if there's a data issue
		 */
		console.log(
			"Total variant views was 0, checking for upstream data issue..."
		);
		const channels = new Set(
			banditTestConfigs.map((config) => config.channel)
		);
		const totalViewsForChannels = await getTotalComponentViewsForChannels(
			client,
			Array.from(channels),
			stage,
			start,
			end
		);

		console.log(`Total views across all tests is ${totalViewsForChannels}`);
		if (totalViewsForChannels === 0) {
			await putMetric("NoViewsData", 1);
		}
	}

	await putBanditTestMetrics(resultsFromBigQuery);

	if (writeRequests.length <= 0) {
		console.log("No data to write");
		return;
	}

	await writeBatch(writeRequests, stage, docClient);
}
