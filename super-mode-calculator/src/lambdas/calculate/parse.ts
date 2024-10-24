import type {
	QueryRowsResponse,
	SimpleQueryRowsResponse,
} from '@google-cloud/bigquery';
import { RowMetadata } from '@google-cloud/bigquery/build/src/table';
import type { GetQueryResultsOutput } from 'aws-sdk/clients/athena';
import { z } from 'zod';
import { QueryReturnedInvalidDataError } from '../../lib/errors';

const URL_COL = 0;
const REGION_COL = 1;
const TOTAL_AV_COL = 2;
const TOTAL_VIEWS_COL = 3;
const AV_PER_VIEW_COL = 4;

export type Region = 'GB' | 'US' | 'AU' | 'NZ' | 'CA' | 'EU' | 'ROW';

export interface QueryRow {
	url: string;
	region: Region;
	totalAv: number;
	totalViews: number;
	avPerView: number;
}

const regionSchema = z.union([
	z.literal('GB'),
	z.literal('US'),
	z.literal('AU'),
	z.literal('NZ'),
	z.literal('CA'),
	z.literal('EU'),
	z.literal('ROW'),
]);

const queryRowSchema = z.object({
	url: z.string(),
	region: regionSchema,
	totalAv: z.number(),
	totalViews: z.number(),
	avPerView: z.number(),
});

const queryRowsSchema = z.array(queryRowSchema);

export function parseResult(result: GetQueryResultsOutput): QueryRow[] {
	const rows = (result.ResultSet?.Rows ?? []).slice(1);
	const data = rows.map(({ Data: data }) => {
		if (!data) {
			return;
		}

		return {
			url: data[URL_COL].VarCharValue,
			region: data[REGION_COL].VarCharValue,
			totalAv: parseFloat(data[TOTAL_AV_COL].VarCharValue ?? ''),
			totalViews: parseFloat(data[TOTAL_VIEWS_COL].VarCharValue ?? ''),
			avPerView: parseFloat(data[AV_PER_VIEW_COL].VarCharValue ?? ''),
		};
	});

	const parse = queryRowsSchema.safeParse(data);

	if (!parse.success) {
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}

export function parseResultFromBigQuery(
	result: SimpleQueryRowsResponse,
): QueryRow[] {
	console.log('Parsing result from BigQuery RowMetadata[]: ', result[0]);

	const parse = queryRowsSchema.safeParse(result[0]);

	if (!parse.success) {
		console.log(parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}
