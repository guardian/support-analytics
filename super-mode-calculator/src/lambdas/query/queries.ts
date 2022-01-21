import { subHours } from 'date-fns';
import {
	SUPER_MODE_MINIMUM_AV,
	SUPER_MODE_MINIMUM_VIEWS,
	SUPER_MODE_WINDOW_IN_HOURS,
} from '../../lib/constants';
import { toDateHourString, toDateString } from '../../lib/date';
import { Query } from '../../lib/query';
import { REGION_SQL } from './regionSql';

export function getQuery(stage: string, now: Date = new Date()): Query {
	const windowStartDate = subHours(now, SUPER_MODE_WINDOW_IN_HOURS);

	const dateString = toDateString(windowStartDate);
	const dateHourString = toDateHourString(windowStartDate);

	const nowDateHourString = toDateHourString(now);

	return new Query(
		`
WITH
  acquisitions_with_regions AS (
  SELECT
    *,
	${REGION_SQL}
  FROM
    acquisition_events_prod
  WHERE
    acquisition_date >= DATE '${dateString}'
    AND timestamp >= TIMESTAMP '${dateHourString}' AND timestamp <= TIMESTAMP '${nowDateHourString}' ),
  av AS (
  SELECT
    referrerurl AS url,
	region,
    SUM(annualisedValueGBP) AS total_av
  FROM
    acquisitions_with_regions
  GROUP BY
    referrerurl,
	region ),
  views_with_regions AS (
	SELECT
	  *,
	  ${REGION_SQL}
	FROM
	  epic_views_prod
    WHERE
    date_hour >= TIMESTAMP '${dateHourString}' AND date_hour <= TIMESTAMP '${nowDateHourString}' ),
  views AS (
  SELECT
    url,
	region,
    COUNT(*) AS total_views
  FROM
	views_with_regions
  GROUP BY
    url,
	region )
SELECT
  av.url,
  av.region,
  av.total_av,
  views.total_views,
  av.total_av / views.total_views AS av_per_view
FROM
  av
INNER JOIN
  views
ON
  av.url=views.url
  AND av.region=views.region
WHERE views.total_views > ${SUPER_MODE_MINIMUM_VIEWS}

  `,
		'query_acquisitions_and_epic_views',
	);
}
