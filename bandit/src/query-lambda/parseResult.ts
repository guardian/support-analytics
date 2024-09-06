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

export function parseResultFromBigQuery(result: SimpleQueryRowsResponse[]): VariantQueryRow[] {
	console.log("ResultFromBigQuery", result);
	const parsedResult= result.map((row) => {
		return {
			testName: row[0],
			variantName: row[1],
			views:  "test",
			avGbp: "test",
			avGbpPerView:"test",
			acquisitions: "test",
		};
	});

	const parse = variantQueryRowsSchema.safeParse(parsedResult);

	if (!parse.success) {
		console.log(parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}
