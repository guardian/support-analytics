import { putMetric } from "../lib/aws/cloudwatch";
import { putBanditTestMetrics } from "./query-lambda";

jest.mock("../lib/aws/cloudwatch", () => ({
	putMetric: jest.fn().mockResolvedValue(undefined),
}));

describe("putBanditTestMetrics", () => {
	it("should send metrics for bandit tests", async () => {
		const mockPutMetric = putMetric as jest.Mock;
		mockPutMetric.mockClear();

		const banditTestConfigs = [{ name: "Test1", channel: "Epic" }];
		const writeRequests = [
			{
				PutRequest: {
					Item: {
						variants: {
							L: [{ M: { variantName: { S: "Variant1" } } }],
						},
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
