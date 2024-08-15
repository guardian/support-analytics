import { Transform } from "stream";
import { z } from "zod";

// The model for the Segmentation Dynamodb table
export const segmentationSchema = z.object({
	product: z.string(),
	amount: z.number(),
	eventTimestamp: z.string(),
});
export type Segmentation = z.infer<typeof segmentationSchema>;


// The model we receive from BigQuery
const bigQueryRowSchema = z.object({
	product: z.string(),
	amount: z.number(),
	event_timestamp: z.object({
		value: z.string(),
	}),
});

// Stream transformer, for transforming BigQuery row => SegmentationRow
export const bigQueryRowTransformer = new Transform({
	objectMode: true,
	transform(data, encoding, callback) {
		const bigQueryRow = bigQueryRowSchema.safeParse(data);
		console.log("BigQuery row", bigQueryRow);
		if (bigQueryRow.success) {
			const row : Segmentation = {
				product: bigQueryRow.data.product,
				amount: bigQueryRow.data.amount,
				eventTimestamp: bigQueryRow.data.event_timestamp.value,
			};
		} else {
			console.log(`Invalid BigQuery row: ${String(bigQueryRow.error)}`, data);
			callback(Error(`Invalid BigQuery row: ${String(bigQueryRow.error)}`));
		}
	},
});
