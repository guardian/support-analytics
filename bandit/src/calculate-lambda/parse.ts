import type { GetQueryResultsOutput } from "aws-sdk/clients/athena";
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

export function parseResult(result: GetQueryResultsOutput): VariantQueryRow[] {
	const rows = (result.ResultSet?.Rows ?? []).slice(1);
	const data = rows.map(({ Data: data }) => {
		if (!data) {
			return;
		}
		console.log({ data });

		return {
			testName: data[0].VarCharValue,
			variantName: data[1].VarCharValue,
			views: parseInt(data[2].VarCharValue ?? ""),
			avGbp: parseFloat(data[3].VarCharValue ?? ""),
			avGbpPerView: parseFloat(data[4].VarCharValue ?? ""),
			acquisitions: parseInt(data[5].VarCharValue ?? ""),
		};
	});

	const parse = variantQueryRowsSchema.safeParse(data);

	if (!parse.success) {
		console.log(parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}
