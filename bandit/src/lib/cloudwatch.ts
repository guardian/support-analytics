import * as AWS from "aws-sdk";

const cloudwatch = new AWS.CloudWatch({ region: "eu-west-1" });
const stage = process.env.STAGE ?? "PROD";
const namespace = `support-bandit-${stage}`;

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
