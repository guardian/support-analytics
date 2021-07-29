import { subHours } from 'date-fns';
import { SUPER_MODE_WINDOW_IN_HOURS } from '../../lib/constants';
import {
	toDateHourPath,
	toDateHourString,
	toDatePath,
	toDateString,
} from '../../lib/date';
import { Query } from '../../lib/query';

export function getQueries(stage: string, now: Date = new Date()): Query[] {
	return [
		getEpicViewsPartitionQuery(stage, now),
		getAcquisitionEventsPartitionQuery(stage, now),
	];
}

function getEpicViewsPartitionQuery(stage: string, now: Date): Query {
	function partitionSql(hoursAgo: number) {
		const time = subHours(now, hoursAgo);

		const dateHourString = toDateHourString(time);
		const dateHourPath = toDateHourPath(time);

		return `PARTITION (date_hour='${dateHourString}') location 's3://gu-support-analytics/epic-views/${stage}/${dateHourPath}'`;
	}

	const partitions = [...Array(SUPER_MODE_WINDOW_IN_HOURS).keys()]
		.map((h) => partitionSql(h + 1))
		.join('\n');

	return new Query(
		`
    ALTER TABLE epic_views_${stage.toLowerCase()} ADD IF NOT EXISTS
	${partitions}
  `,
		'partition_epic_views_table',
	);
}

function getAcquisitionEventsPartitionQuery(stage: string, now: Date) {
	function partitionSql() {
		const dateString = toDateString(now);
		const datePath = toDatePath(now);

		return `PARTITION (acquisition_date='${dateString}') location 's3://acquisition-events/${stage}/${datePath}'`;
	}

	return new Query(
		`
    ALTER TABLE acquisition_events_${stage.toLowerCase()} ADD IF NOT EXISTS
    ${partitionSql()}
    `,
		'partition_acquisition_events_table',
	);
}
