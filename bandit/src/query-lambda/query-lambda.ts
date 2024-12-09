import * as AWS from "aws-sdk";
import { set, subHours } from "date-fns";
import type {BanditTestConfig, Methodology, Test} from "../lib/models";
import type {BigQueryResult} from "./bigquery";
import { buildAuthClient, getDataForBanditTest} from "./bigquery";
import {buildWriteRequest, writeBatch} from "./dynamo";
import {parseResultFromBigQuery} from "./parse-result";
import {getSSMParam} from "./ssm";

const stage = process.env.STAGE;
const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });


export interface QueryLambdaInput {
	tests: Test[];
	date?: Date;
}

// Each test may contain 1 or more bandit methodologies
const getTestConfigs = (test: Test): BanditTestConfig[] => {
	const bandits: Methodology[] = (test.methodologies ?? []).filter(
		(method) => method.name === 'EpsilonGreedyBandit'|| method.name === 'Roulette',
	);
	return bandits.map((method) => ({
		name: method.testName ?? test.name, // if the methodology should be tracked with a different name then use that
		channel: test.channel,
	}));
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
	const client = await getSSMParam(ssmPath).then(buildAuthClient);

	const banditTestConfigs: BanditTestConfig[] = input.tests.flatMap(test => getTestConfigs(test));

	const resultsFromBigQuery: BigQueryResult[] = await Promise.all(
		banditTestConfigs.map(test => getDataForBanditTest(client, stage, test, start))
	);

	const writeRequests = resultsFromBigQuery.map(({testName,channel, rows}) => {
		const parsed = parseResultFromBigQuery(rows);
		console.log(`Writing row for ${testName}: `, parsed);
		return buildWriteRequest(parsed, testName,channel, startTimestamp);
	});
	if (writeRequests.length > 0) {
		await writeBatch(writeRequests, stage, docClient);
	} else {
		console.log("No data to write");
	}

	return;
}


