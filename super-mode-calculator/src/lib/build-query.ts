import { format, subDays, subHours } from 'date-fns';
import { regionSql } from '../lambdas/regionSql';
import {
	SUPER_MODE_MINIMUM_AV,
	SUPER_MODE_MINIMUM_VIEWS,
	SUPER_MODE_WINDOW_IN_HOURS,
} from './constants';
import { toDateHourString, toDateString } from './date';

export const buildQueryForSuperMode = (
	stage: 'CODE' | 'PROD',
	now: Date = new Date(),
) => {
	const end = subHours(now, 1);
	const windowStartDate = subHours(end, SUPER_MODE_WINDOW_IN_HOURS);

	const dateString = toDateString(windowStartDate);
	const dateHourString = toDateHourString(windowStartDate);
	const dateForCurrencyConversionTable = subDays(windowStartDate, 1); //This table is updated daily  but has a lag of 1 day
	const endDateHourString = toDateHourString(end);

	return `
WITH
exchange_rates AS (
	SELECT target AS from_currency,(SELECT FIRST_VALUE(rate) OVER (PARTITION BY target ORDER BY rate ASC) AS eur_to_gbp_rate
	FROM datatech-platform-prod.datalake.fixer_exchange_rates
	WHERE target = 'GBP' AND date = '${format(
		dateForCurrencyConversionTable,
		'yyyy-MM-dd',
	)}') * (1/rate) AS to_gbp_rate
	FROM datatech-platform-prod.datalake.fixer_exchange_rates
	WHERE date = '${format(dateForCurrencyConversionTable, 'yyyy-MM-dd')}'),
acquisitions AS (
	SELECT
		CASE product
			WHEN 'SUPPORTER_PLUS' THEN
				CASE currency
					WHEN 'GBP' THEN
						CASE payment_frequency
							WHEN 'MONTHLY' THEN 12
							WHEN 'ANNUALLY' THEN 120
							END
					WHEN 'USD' THEN
						CASE payment_frequency
							WHEN 'MONTHLY' THEN 15
							WHEN 'ANNUALLY' THEN 150
							END
					WHEN 'AUD' THEN
						CASE payment_frequency
							WHEN 'MONTHLY' THEN 20
							WHEN 'ANNUAL' THEN 200
							END
					WHEN 'EUR' THEN
						CASE payment_frequency
							WHEN 'MONTHLY' THEN 12
							WHEN 'ANNUALLY' THEN 120
							END
					WHEN 'NZD' THEN
						CASE payment_frequency
							WHEN 'MONTHLY' THEN 20
							WHEN 'ANNUALLY' THEN 200
							END
					WHEN 'CAD' THEN
						CASE payment_frequency
							WHEN 'MONTHLY' THEN 15
							WHEN 'ANNUALLY' THEN 150
							END
					END
			WHEN 'CONTRIBUTION' THEN amount
			WHEN 'RECURRING_CONTRIBUTION' THEN amount
			END AS amount,
		CASE
			WHEN country_Code = 'GB' THEN 'GB'
			WHEN country_Code= 'US' THEN 'US'
			WHEN country_Code = 'AU' THEN 'AU'
			WHEN country_Code = 'NZ' THEN 'NZ'
			WHEN country_Code = 'CA' THEN 'CA'
			WHEN country_Code IN (
			'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'BL',
			'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES',
			'FI', 'FO', 'FR', 'GF', 'GL', 'GP', 'GR',
			'HR', 'HU', 'IE', 'IT', 'LI', 'LT', 'LU',
			'LV', 'MC', 'ME', 'MF', 'IS', 'MQ', 'MT',
			'NL', 'NO', 'PF', 'PL', 'PM', 'PT', 'RE',
			'RO', 'RS', 'SE', 'SI', 'SJ', 'SK', 'SM',
			'TF', 'TR', 'WF', 'YT', 'VA', 'AX'
			) THEN 'EU'
			ELSE
			'ROW'
		END AS region,
	product, currency, country_code, referrer_url, payment_frequency,
	FROM datatech-platform-prod.datalake.fact_acquisition_event AS acq
	WHERE event_timestamp >= timestamp '${dateHourString}' AND event_timestamp <  timestamp '${endDateHourString}'),
acquisitions_with_av_gbp AS (
	SELECT acq.*,
		CASE payment_frequency
			WHEN 'ONE_OFF' THEN amount * exch.to_gbp_rate
			WHEN 'MONTHLY' THEN (amount * exch.to_gbp_rate)*12
			WHEN 'ANNUALLY' THEN amount * exch.to_gbp_rate
			END AS av_gbp, exch.from_currency
		FROM acquisitions AS acq JOIN exchange_rates AS exch ON acq.currency = exch.from_currency),
acquisitions_agg AS (
	SELECT region, referrer_url, SUM(av_gbp) sum_av_gbp, COUNT(*) acquisitions
	FROM acquisitions_with_av_gbp
	GROUP BY 1, 2
	),
views_with_regions AS (
		SELECT *,  ${regionSql('country_key')}
		FROM datatech-platform-${stage.toLowerCase()}.online_traffic.fact_page_view_anonymised CROSS JOIN UNNEST(component_event_array) as ce
		WHERE received_date >= DATE_SUB('${dateString}', INTERVAL 1 DAY) AND received_date <= '${dateString}' AND  ce.component_type = 'ACQUISITIONS_EPIC' AND ce.event_action = 'VIEW' AND
		ce.event_timestamp >= TIMESTAMP '${dateHourString}'  AND ce.event_timestamp < TIMESTAMP '${endDateHourString}')	,
views AS (
		SELECT CONCAT(protocol,'://',host,path) AS url, region, COUNT (*) AS total_views
		FROM views_with_regions
		GROUP BY 1, 2)
SELECT acquisitions_agg.referrer_url AS url,
	   acquisitions_agg.region,
	   acquisitions_agg.sum_av_gbp AS totalAv,
	   views.total_views AS totalViews,
	   acquisitions_agg.sum_av_gbp / views.total_views AS avPerView
	FROM acquisitions_agg
	INNER JOIN views ON acquisitions_agg.referrer_url = views.url AND acquisitions_agg.region = views.region
	WHERE views.total_views > ${SUPER_MODE_MINIMUM_VIEWS}
	AND acquisitions_agg.sum_av_gbp > ${SUPER_MODE_MINIMUM_AV}
	`;
};
