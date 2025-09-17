import { putMetric } from "./cloudwatch";

const mockSend = jest.fn();

// Mock AWS SDK v3 client
jest.mock("@aws-sdk/client-cloudwatch", () => {
	return {
		// CloudWatchClient is a class whose instances have a `send` method
		CloudWatchClient: jest.fn(() => ({
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- forwarding unknown args to the jest mock which intentionally has a loose type for testing
			send: (...args: unknown[]) => mockSend(...args),
		})),
		PutMetricDataCommand: jest.fn((input: unknown) => ({ input })),
	};
});

describe("putMetric", () => {
	beforeEach(() => {
		mockSend.mockClear();
		// AWS SDK v3 clients return a Promise from `send`
		mockSend.mockImplementation(() => Promise.resolve({}));
	});

	it("should send a metric to CloudWatch", async () => {
		await putMetric("TestMetric", 1);
		// Our PutMetricDataCommand mock returns an object like { input }
		expect(mockSend).toHaveBeenCalledWith(
			expect.objectContaining({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- PutMetricDataCommand mock returns an unknown-typed `input` used only for assertions in this test
				input: expect.objectContaining({
					Namespace: "support-bandit-PROD",
					MetricData: [
						expect.objectContaining({
							MetricName: "TestMetric",
							Value: 1,
							Unit: "Count",
							// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect.any() returns unknown type
							Timestamp: expect.any(Date),
						}),
					],
				}),
			})
		);
	});

	it("should log an error if sending the metric fails", async () => {
		mockSend.mockRejectedValueOnce(new Error("Failed"));

		const consoleErrorSpy = jest
			.spyOn(console, "error")
			.mockImplementation();

		await putMetric("TestMetric", 1);

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"Failed to send CloudWatch metric:",
			expect.any(String)
		);

		consoleErrorSpy.mockRestore();
	});
});
