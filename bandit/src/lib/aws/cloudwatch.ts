import * as AWS from "aws-sdk";
import { config } from "./config";

const { region, namespace, credentials } = config;
const cloudwatch = new AWS.CloudWatch({ region, credentials });

export const putMetric = async (
	metricName: string,
	value: number,
	unit = "Count"
): Promise<void> => {
	try {
		await cloudwatch
			.putMetricData({
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
			.promise();
		console.log(`CloudWatch metric sent: ${metricName} = ${value}`);
	} catch (error) {
		console.error("Failed to send CloudWatch metric:", error);
	}
};
