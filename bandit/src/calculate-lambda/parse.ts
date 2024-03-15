import {GetQueryResultsOutput} from "aws-sdk/clients/athena";
import {QueryReturnedInvalidDataError} from "../lib/errors";
import { z } from 'zod';

const queryRowSchema = z.object({
	testName: z.string(),
	variantName: z.string(),
	views: z.number(),
	avGbp: z.number(),
	acquisitions: z.number(),
});

export type QueryRow = z.infer<typeof queryRowSchema>;

const queryRowsSchema = z.array(queryRowSchema);

export function parseResult(result: GetQueryResultsOutput): QueryRow[] {
	const rows = (result.ResultSet?.Rows ?? []).slice(1);
	const data = rows.map(({ Data: data }) => {
		if (!data) {
			return;
		}
		console.log({data})

		return {
			testName: data[0].VarCharValue,
			variantName: data[1].VarCharValue,
			views: parseInt(data[2].VarCharValue ?? ''),
			avGbp: parseFloat(data[3].VarCharValue ?? ''),
			acquisitions: parseInt(data[4].VarCharValue ?? ''),
		};
	});

	const parse = queryRowsSchema.safeParse(data);

	if (parse.success === false) {
		console.log(parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}
