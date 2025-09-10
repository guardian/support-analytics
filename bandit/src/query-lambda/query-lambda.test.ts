/* eslint-disable import/order, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-call -- jest.mock needs to run before importing modules that depend on the mocked module */
import type { DocumentClient } from "aws-sdk/clients/dynamodb";

jest.mock("../lib/aws/cloudwatch", () => ({
	putMetric: jest.fn().mockResolvedValue(undefined),
}));

const { putMetric } = require("../lib/aws/cloudwatch");
const { putBanditTestMetrics } = require("./query-lambda");

describe("putBanditTestMetrics", () => {
	it("should send metrics for bandit tests", async () => {
		const mockPutMetric = putMetric as jest.Mock;
		mockPutMetric.mockClear();

		const banditTestConfigs = [{ name: "Test1", channel: "Epic" }];
		const writeRequests: DocumentClient.WriteRequest[] = [
			{
				PutRequest: {
					Item: {
						testName: "Epic_Test1",
						variants: [
							{
								variantName: "Variant1",
								annualisedValueInGBP: 10,
								annualisedValueInGBPPerView: 0.1,
								views: 100,
								totalViewsForComponentType: 1000,
							},
						],
						timestamp: "2023-01-01 00:00:00.000",
					},
				},
			},
		];

		await putBanditTestMetrics(banditTestConfigs, writeRequests);

		expect(mockPutMetric).toHaveBeenCalledTimes(4);
		expect(mockPutMetric).toHaveBeenCalledWith("TotalBanditTests", 1);
		expect(mockPutMetric).toHaveBeenCalledWith("TestsWithData", 1);
		expect(mockPutMetric).toHaveBeenCalledWith("TestsWithoutData", 0);
		expect(mockPutMetric).toHaveBeenCalledWith(
			"PercentageTestsWithoutData",
			0,
			"Percent"
		);
	});
});
