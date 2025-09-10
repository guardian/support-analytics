import type { StandardUnit } from "@aws-sdk/client-cloudwatch";
import {
	CloudWatchClient,
	PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { config, credentials, region } from "./config";

console.log("Creating CloudWatchClient");
const cloudwatch = new CloudWatchClient({
	region,
	credentials: credentials(),
});
console.log("CloudWatchClient created");

export const putMetric = async (
	metricName: string,
	value: number,
	unit: StandardUnit = "Count"
): Promise<void> => {
	try {
		await cloudwatch.send(
			new PutMetricDataCommand({
				Namespace: config.namespace,
				MetricData: [
					{
						MetricName: metricName,
						Value: value,
						Unit: unit,
						Timestamp: new Date(),
					},
				],
			})
		);
		console.log(`CloudWatch metric sent: ${metricName} = ${value}`);
	} catch (error) {
		console.error("Failed to send CloudWatch metric:", String(error));
	}
};
