import {GetQueryResultsOutput} from "aws-sdk/clients/athena";
import {QueryReturnedInvalidDataError} from "../lib/errors";
import { z } from 'zod';

const queryRowSchema = z.object({
	test: z.string(),
	variant: z.string(),
	views: z.number(),
	av_gbp: z.number(),
});

export type QueryRow = z.infer<typeof queryRowSchema>;

const queryRowsSchema = z.array(queryRowSchema);

export function parseResult(result: GetQueryResultsOutput): QueryRow[] {
	const rows = (result.ResultSet?.Rows ?? []).slice(1);
	const data = rows.map(({ Data: data }) => {
		if (!data) {
			return;
		}

		return {
			test: data[0].VarCharValue,
			variant: data[1].VarCharValue,
			views: parseInt(data[2].VarCharValue ?? ''),
			av_gbp: parseFloat(data[3].VarCharValue ?? ''),
		};
	});

	const parse = queryRowsSchema.safeParse(data);

	if (parse.success === false) {
		console.log(parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}
