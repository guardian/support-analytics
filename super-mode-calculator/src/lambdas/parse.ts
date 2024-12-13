import type { SimpleQueryRowsResponse } from '@google-cloud/bigquery';
import { z } from 'zod';
import { QueryReturnedInvalidDataError } from '../lib/errors';

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

export function parseResultFromBigQuery(
	result: SimpleQueryRowsResponse,
): QueryRow[] {
	const parse = queryRowsSchema.safeParse(result[0]);

	if (!parse.success) {
		console.log(parse.error);
		throw new QueryReturnedInvalidDataError();
	}

	return parse.data;
}
