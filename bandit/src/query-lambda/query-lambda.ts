import * as AWS from "aws-sdk";
import { addHours, set, subHours } from "date-fns";
import { putMetric } from "../lib/aws/cloudwatch";
import type { BanditTestConfig, Methodology, Test } from "../lib/models";
import type { BigQueryResult} from "./bigquery";
import { buildAuthClient , getDataForBanditTest, getTotalComponentViewsForChannels } from "./bigquery";
import { buildWriteRequest, writeBatch } from "./dynamo";
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
	totalViewsForChannels: Record<string,number>,
	testsData: BigQueryResult[],
): Promise<void> => {
	const totalTests = testsData.length;

	const testsWithData = testsData.filter(test => {
		return test.rows.length > 0 && totalViewsForChannels[test.channel] > 0;
	}).length;

	const testsWithoutData = totalTests - testsWithData

	console.log(
		JSON.stringify({
			message: "Calculating metrics for",
			testsData,
			channelTotalImpressions: totalViewsForChannels,
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
}

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

	// Get total views for each channel. We use this for detecting data issues
	const channels = new Set(banditTestConfigs.map(config => config.channel));
	const totalViewsForChannels = await getTotalComponentViewsForChannels(client, Array.from(channels), stage, start, end);

	await putBanditTestMetrics(totalViewsForChannels, resultsFromBigQuery);

	if (writeRequests.length <= 0) {
		console.log("No data to write");
		return;
	}

	await writeBatch(writeRequests, stage, docClient);
}
