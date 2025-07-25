import { putMetric } from "./cloudwatch";

const mockPutMetricData = jest.fn();

jest.mock("aws-sdk", () => {
	return {
		CloudWatch: jest.fn(() => ({
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mock function needs to return unknown type for Jest compatibility
			putMetricData: (...args: unknown[]) => mockPutMetricData(...args),
		})),
		ChainableTemporaryCredentials: jest.fn(),
		SharedIniFileCredentials: jest.fn(),
		config: {
			region: "",
		},
	};
});

describe("putMetric", () => {
	beforeEach(() => {
		mockPutMetricData.mockClear();
		mockPutMetricData.mockImplementation(() => ({
			promise: jest.fn().mockResolvedValue({}),
		}));
	});

	it("should send a metric to CloudWatch", async () => {
		await putMetric("TestMetric", 1);
		expect(mockPutMetricData).toHaveBeenCalledWith({
			Namespace: "support-bandit-PROD",
			MetricData: [
				{
					MetricName: "TestMetric",
					Value: 1,
					Unit: "Count",
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect.any() returns unknown type
					Timestamp: expect.any(Date),
				},
			],
		});
	});

	it("should log an error if sending the metric fails", async () => {
		mockPutMetricData.mockReturnValueOnce({
			promise: jest.fn().mockRejectedValue(new Error("Failed")),
		});

		const consoleErrorSpy = jest
			.spyOn(console, "error")
			.mockImplementation();

		await putMetric("TestMetric", 1);

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"Failed to send CloudWatch metric:",
			expect.any(Error)
		);

		consoleErrorSpy.mockRestore();
	});
});
