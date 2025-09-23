import type { StandardUnit } from "@aws-sdk/client-cloudwatch";
import {
	CloudWatchClient,
	PutMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import { namespace, region } from "./config";

const cloudwatch = new CloudWatchClient({
	region,
});

export const putMetric = async (
	metricName: string,
	value: number,
	unit: StandardUnit = "Count"
): Promise<void> => {
	try {
		await cloudwatch.send(
			new PutMetricDataCommand({
				Namespace: namespace,
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
