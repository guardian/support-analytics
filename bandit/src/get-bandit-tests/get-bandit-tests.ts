import * as AWS from "aws-sdk";
import type { Test } from "../lib/models";
import { queryChannelTests } from "./dynamo";

const STAGE: string = process.env.Stage ?? "PROD";

const docClient = new AWS.DynamoDB.DocumentClient({ region: "eu-west-1" });

export async function run(): Promise<Test[]> {
	const banditTests = await queryChannelTests(STAGE, docClient);
	return banditTests.Items as Test[];
}
