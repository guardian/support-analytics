import type {SimpleQueryRowsResponse} from "@google-cloud/bigquery";
import { z } from "zod";
import { QueryReturnedInvalidDataError } from "../lib/errors";

const variantQueryRowSchema = z.object({
	testName: z.string(),
	variantName: z.string(),
	views: z.number(),
	avGbp: z.number(),
	avGbpPerView: z.number(),
	acquisitions: z.number(),
});

export type VariantQueryRow = z.infer<typeof variantQueryRowSchema>;

const variantQueryRowsSchema = z.array(variantQueryRowSchema);

export function parseResultFromBigQuery(result: SimpleQueryRowsResponse): VariantQueryRow[] {
	console.log("ResultFromBigQuery", result);
<<<<<<< HEAD
=======

>>>>>>> ac928a8 (Remove unwanted console statements)
	const parse = variantQueryRowsSchema.safeParse(result[0]);

	if (!parse.success) {
		console.log(parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}
