import { format, subDays, subHours } from 'date-fns';
import { REGION_SQL_v2, REGION_SQL_v3 } from '../lambdas/query/regionSql';
import {
	SUPER_MODE_MINIMUM_AV,
	SUPER_MODE_MINIMUM_VIEWS,
	SUPER_MODE_WINDOW_IN_HOURS,
} from './constants';
import { toDateHourString, toDateString } from './date';

export interface BigQueryResult {
	url: string;
	region: string;
	total_av: number;
	total_views: number;
	av_per_view: number;
}

export const buildQueryForSuperMode = (
	stage: 'CODE' | 'PROD',
	now: Date = new Date(),
) => {
	const windowStartDate = subHours(now, SUPER_MODE_WINDOW_IN_HOURS);

	const dateString = toDateString(windowStartDate);
	const dateHourString = toDateHourString(windowStartDate);
	const dateForCurrencyConversionTable = subDays(windowStartDate, 1); //This table is updated daily  but has a lag of 1 day

	return `
WITH
acquisitions_with_regions AS (SELECT *,${REGION_SQL_v2}
		FROM datatech-platform-${stage.toLowerCase()}.datalake.fact_acquisition_event
		WHERE
			DATE (event_timestamp) >= '${dateString}'
		  AND
			event_timestamp >= TIMESTAMP '${dateHourString}'),
exchange_rates AS (
		SELECT target, date, (1/rate) AS reverse_rate
		FROM datatech-platform-${stage.toLowerCase()}.datalake.fixer_exchange_rates
		WHERE date = '${format(dateForCurrencyConversionTable, 'yyyy-MM-dd')}'),
gbp_rate AS (
		SELECT
			rate, date
		FROM datatech-platform-${stage.toLowerCase()}.datalake.fixer_exchange_rates
		WHERE target = 'GBP'
		  AND date = '${format(dateForCurrencyConversionTable, 'yyyy-MM-dd')}'),
acquisitions AS (
		SELECT
			CASE product
			WHEN 'SUPPORTER_PLUS' THEN
			CASE currency
			WHEN 'GBP' THEN
			CASE payment_frequency
			WHEN 'MONTHLY' THEN 12
			WHEN 'ANNUAL' THEN 120
			END
			WHEN 'USD' THEN
			CASE payment_frequency
			WHEN 'MONTHLY' THEN 15
			WHEN 'ANNUAL' THEN 150
			END
			WHEN 'AUD' THEN
			CASE payment_frequency
			WHEN 'MONTHLY' THEN 20
			WHEN 'ANNUAL' THEN 200
			END
			WHEN 'EUR' THEN
			CASE payment_frequency
			WHEN 'MONTHLY' THEN 12
			WHEN 'ANNUAL' THEN 120
			END
			WHEN 'NZD' THEN
			CASE payment_frequency
			WHEN 'MONTHLY' THEN 20
			WHEN 'ANNUAL' THEN 200
			END
			WHEN 'CAD' THEN
			CASE payment_frequency
			WHEN 'MONTHLY' THEN 15
			WHEN 'ANNUAL' THEN 150
			END
			END
			WHEN 'CONTRIBUTION' THEN amount
			WHEN 'RECURRING_CONTRIBUTION' THEN amount
			END
			AS amount, product, currency, country_code, referrer_url, payment_frequency,
		FROM datatech-platform-${stage.toLowerCase()}.datalake.fact_acquisition_event AS acq
		WHERE event_timestamp >= timestamp '${dateHourString}'),
acquisitions_with_av AS (
		SELECT
			acq.*, date, CASE payment_frequency
			WHEN 'ONE_OFF' THEN amount * exch.reverse_rate
			WHEN 'MONTHLY' THEN (amount * exch.reverse_rate)*12
			WHEN 'ANNUAL' THEN amount * exch.reverse_rate
			END
			AS av_eur, exch.reverse_rate
		FROM acquisitions AS acq
			JOIN exchange_rates AS exch
		ON acq.currency = exch.target
			),
acquisitions_with_av_gbp AS (
		SELECT
			acq_av.*, CASE acq_av.currency
			WHEN 'GBP' THEN av_eur
			ELSE av_eur * (gbp_rate.rate)
			END
			AS av_gbp
		FROM acquisitions_with_av AS acq_av
			JOIN gbp_rate
		ON acq_av.date = gbp_rate.date
			),
acquisitions_agg AS (
		SELECT
			country_code, referrer_url, SUM (av_gbp) sum_av_gbp, COUNT (*) acquisitions
		FROM acquisitions_with_av_gbp
		GROUP BY 1, 2
			),
av AS (
		SELECT
			acq_agg.referrer_url AS url, acq_region.region AS region, SUM ( acq_agg.sum_av_gbp) AS total_av,
		FROM
			acquisitions_with_regions as acq_region
			JOIN acquisitions_agg AS acq_agg
		ON acq_region.region =acq_agg.country_code
		GROUP BY 1, 2),
views_with_regions AS (
		SELECT *,  ${REGION_SQL_v3}
		FROM
			datatech-platform-${stage.toLowerCase()}.online_traffic.fact_page_view_anonymised
			CROSS JOIN UNNEST(component_event_array) as ce
		WHERE received_date >= DATE_SUB('${dateString}'
			, INTERVAL 1 DAY)
		  AND received_date <= '${dateString}'
		  AND
			ce.event_timestamp >= TIMESTAMP '${dateHourString}' )
			,
views AS (
		SELECT
			referrer_url_raw AS url, region, COUNT (*) AS total_views
		FROM
			views_with_regions
		GROUP BY 1, 2
			)
SELECT av.url,
	   av.region,
	   av.total_av AS totalAv,
	   views.total_views AS totalViews,
	   av.total_av / views.total_views AS avPerView
	FROM av
	INNER JOIN views ON av.url = views.url AND av.region = views.region
	WHERE views.total_views > ${SUPER_MODE_MINIMUM_VIEWS}
	AND av.total_av > ${SUPER_MODE_MINIMUM_AV}
	`;
};
