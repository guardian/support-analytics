import { putMetric } from "../lib/aws/cloudwatch";
import { putBanditTestMetrics } from "./query-lambda";

jest.mock("../lib/aws/cloudwatch", () => ({
	putMetric: jest.fn().mockResolvedValue(undefined),
}));

describe("putBanditTestMetrics", () => {
	it("should send metrics for bandit tests", async () => {
		const mockPutMetric = putMetric as jest.Mock;
		mockPutMetric.mockClear();

		const totalViewsForChannels = { 'Epic': 1000 };
		const testsData = [{
			testName: 'Test1',
			channel: 'Epic',
			rows: [
				{
					test_name: "Test1",
					variant_name: "Variant1",
					views: 100,
					sum_av_gbp: 10,
					sum_av_gbp_per_view: 0.1,
					acquisitions: 5,
				},
			]
		}];

		await putBanditTestMetrics(totalViewsForChannels, testsData);

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
