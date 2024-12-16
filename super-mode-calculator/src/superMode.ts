import { SUPER_MODE_AV_PER_VIEWS_THRESHOLDS } from './lib/constants';
import type { DynamoRecord } from './lib/dynamo';
import type { QueryRow } from './parse';

export function isCurrentlyInSuperMode(
	row: QueryRow,
	activeArticles: DynamoRecord[],
): boolean {
	return activeArticles.some(
		(a) => a.url == row.url && a.region == row.region,
	);
}

export function shouldEnterSuperMode(row: QueryRow): boolean {
	return row.avPerView >= SUPER_MODE_AV_PER_VIEWS_THRESHOLDS[row.region];
}
