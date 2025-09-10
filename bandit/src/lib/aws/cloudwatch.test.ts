/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- mocking module before import and using require for runtime mocks */

jest.mock("@aws-sdk/client-cloudwatch", () => {
	const PutMetricDataCommand = jest.fn((input: unknown) => ({ input }));
	const CloudWatchClient = jest.fn().mockImplementation(() => ({
		send: jest.fn().mockResolvedValue({}),
	}));
	return { CloudWatchClient, PutMetricDataCommand };
});

// Require the module under test inside isolateModules where needed.

describe("putMetric", () => {
	beforeEach(() => {
		const cw = require("@aws-sdk/client-cloudwatch");
		// clear mocks on the exported constructors
		cw.CloudWatchClient.mockClear();
		cw.PutMetricDataCommand.mockClear();
	});

	it("should send a metric to CloudWatch", async () => {
		let putMetricFn: unknown;
		jest.isolateModules(() => {
			// require the module with the mocked AWS SDK in place
			putMetricFn = require("./cloudwatch").putMetric;
		});
		await (putMetricFn as (...args: unknown[]) => Promise<unknown>)(
			"TestMetric",
			1
		);
		const cw = require("@aws-sdk/client-cloudwatch");
		expect(cw.CloudWatchClient).toHaveBeenCalled();
		expect(cw.PutMetricDataCommand).toHaveBeenCalledWith({
			Namespace: "support-bandit-PROD",
			MetricData: [
				expect.objectContaining({
					MetricName: "TestMetric",
					Value: 1,
					Unit: "Count",
					Timestamp: expect.any(Date),
				}),
			],
		});

		const instance = cw.CloudWatchClient.mock.results[0].value;
		expect(instance.send).toHaveBeenCalledTimes(1);
	});

	it("should log an error if sending the metric fails", async () => {
		const cw = require("@aws-sdk/client-cloudwatch");
		// make the send of the next instance reject
		cw.CloudWatchClient.mockImplementationOnce(() => ({
			send: jest.fn().mockRejectedValue(new Error("Failed")),
		}));

		let putMetricFn: unknown;
		jest.isolateModules(() => {
			putMetricFn = require("./cloudwatch").putMetric;
		});

		const consoleErrorSpy = jest
			.spyOn(console, "error")
			.mockImplementation();

		await (putMetricFn as (...args: unknown[]) => Promise<unknown>)(
			"TestMetric",
			1
		);

		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"Failed to send CloudWatch metric:",
			expect.any(String)
		);

		consoleErrorSpy.mockRestore();
	});
});
