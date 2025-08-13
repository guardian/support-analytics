import type { SimpleQueryRowsResponse } from "@google-cloud/bigquery";
import { z } from "zod";
import { QueryReturnedInvalidDataError } from "../lib/errors";
import type {
	TestSpecificResult,
	TotalComponentViewsResult,
} from "./query-types";

const variantQueryRowSchema = z.object({
	test_name: z.string(),
	variant_name: z.string(),
	views: z.number(),
	sum_av_gbp: z.number(),
	sum_av_gbp_per_view: z.number(),
	acquisitions: z.number(),
	total_views_for_component_type: z.number().optional(),
});

export type VariantQueryRow = z.infer<typeof variantQueryRowSchema>;

const variantQueryRowsSchema = z.array(variantQueryRowSchema);

const totalComponentViewsSchema = z.object({
	total_views_for_component_type: z.number(),
});

const testSpecificResultSchema = z.object({
	test_name: z.string(),
	variant_name: z.string(),
	views: z.number(),
	sum_av_gbp: z.number(),
	sum_av_gbp_per_view: z.number(),
	acquisitions: z.number(),
});

const testSpecificResultsSchema = z.array(testSpecificResultSchema);

export function parseResultFromBigQuery(
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
): TotalComponentViewsResult {
	const parse = totalComponentViewsSchema.safeParse(result[0][0]);

	if (!parse.success) {
		console.log(
			"Failed to parse total component views result:",
			parse.error
		);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}

export function parseTestSpecificResult(
	result: SimpleQueryRowsResponse
): TestSpecificResult[] {
	const parse = testSpecificResultsSchema.safeParse(result[0]);

	if (!parse.success) {
		console.log("Failed to parse test specific result:", parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}

export function mergeQueryResults(
	testSpecificResults: TestSpecificResult[],
	totalComponentViews: TotalComponentViewsResult
): VariantQueryRow[] {
	return testSpecificResults.map((result) => ({
		...result,
		total_views_for_component_type:
			totalComponentViews.total_views_for_component_type,
	}));
}
