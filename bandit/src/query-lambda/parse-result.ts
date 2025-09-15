import type { SimpleQueryRowsResponse } from "@google-cloud/bigquery";
import { z } from "zod";
import { QueryReturnedInvalidDataError } from "../lib/errors";

const variantQueryRowSchema = z.object({
	test_name: z.string(),
	variant_name: z.string(),
	views: z.number(),
	sum_av_gbp: z.number(),
	sum_av_gbp_per_view: z.number(),
	acquisitions: z.number(),
});

export type VariantQueryRow = z.infer<typeof variantQueryRowSchema>;

const variantQueryRowsSchema = z.array(variantQueryRowSchema);

const totalComponentViewsSchema = z.object({
	total_views_for_component_type: z.number(),
});

type TotalComponentViews = z.infer<typeof totalComponentViewsSchema>;

export function parseVariantQueryRows(
	result: SimpleQueryRowsResponse
): VariantQueryRow[] {
	const parse = variantQueryRowsSchema.safeParse(result[0]);

	if (!parse.success) {
		console.log(parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}

export function parseTotalComponentViewsResult(
	result: SimpleQueryRowsResponse
): TotalComponentViews {
	const parse = totalComponentViewsSchema.safeParse(result[0][0]);

	if (!parse.success) {
		console.log(
			"Failed to parse total component views result:",
			String(parse.error)
		);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}
