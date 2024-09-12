import type {SimpleQueryRowsResponse} from "@google-cloud/bigquery";
import { z } from "zod";
import { QueryReturnedInvalidDataError } from "../lib/errors";

const variantQueryRowSchema = z.object({
	test_name: z.string(),
	variant_name: z.string(),
	views: z.number(),
	sum_av_eur: z.number(),
	sum_av_eur_per_view: z.number(),
	acquisitions: z.number(),
});

export type VariantQueryRow = z.infer<typeof variantQueryRowSchema>;

const variantQueryRowsSchema = z.array(variantQueryRowSchema);

export function parseResultFromBigQuery(result: SimpleQueryRowsResponse): VariantQueryRow[] {
	const parse = variantQueryRowsSchema.safeParse(result[0]);

	if (!parse.success) {
		console.log(parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}
