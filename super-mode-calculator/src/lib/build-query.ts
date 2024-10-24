import { format, subDays, subHours } from 'date-fns';
import { SUPER_MODE_WINDOW_IN_HOURS } from './constants';
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

	return `
		WITH acquisitions_with_regions AS (SELECT *,

												  CASE
													  WHEN country_Code = 'GB' THEN 'GB'
													  WHEN country_Code = 'US' THEN 'US'
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
													  END
													  AS region
										   FROM datatech-platform-prod.datalake.fact_acquisition_event
		WHERE
			DATE (event_timestamp) >= '2024-10-23'
		  AND
			event_timestamp >= TIMESTAMP '2024-10-23 11:00:00.000' )
			, exchange_rates AS (
		SELECT target, date, (1/rate) AS reverse_rate
		FROM datatech-platform-prod.datalake.fixer_exchange_rates
		WHERE date = '2024-10-22')
			, gbp_rate AS (
		SELECT
			rate, date
		FROM datatech-platform-prod.datalake.fixer_exchange_rates
		WHERE target = 'GBP'
		  AND date = '2024-10-22')
			, acquisitions AS (
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
		FROM datatech-platform-prod.datalake.fact_acquisition_event AS acq
		WHERE event_timestamp >= timestamp '2024-10-23 11:00:00.000'
		  AND event_timestamp
			< timestamp '2024-10-23 12:00:00.000'
			)
			, acquisitions_with_av AS (
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
		SELECT
			*, CASE
			WHEN country_key = 'GB' THEN 'GB'
			WHEN country_key = 'US' THEN 'US'
			WHEN country_key = 'AU' THEN 'AU'
			WHEN country_key = 'NZ' THEN 'NZ'
			WHEN country_key = 'CA' THEN 'CA'
			WHEN country_key IN (
			'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'BL', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FO', 'FR', 'GF', 'GL', 'GP', 'GR', 'HR', 'HU', 'IE', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC', 'ME', 'MF', 'IS', 'MQ', 'MT', 'NL', 'NO', 'PF', 'PL', 'PM', 'PT', 'RE', 'RO', 'RS', 'SE', 'SI', 'SJ', 'SK', 'SM', 'TF', 'TR', 'WF', 'YT', 'VA', 'AX'
			) THEN 'EU'
			ELSE
			'ROW'
			END
			AS region
		FROM
			datatech-platform-prod.online_traffic.fact_page_view_anonymised
			CROSS JOIN UNNEST(component_event_array) as ce
		WHERE received_date >= DATE_SUB('2024-10-23'
			, INTERVAL 1 DAY)
		  AND received_date <= '2024-10-23'
		  AND
			ce.event_timestamp >= TIMESTAMP '2024-10-23 11:00:00.000' )
			, views AS (
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
				 INNER JOIN
			 views
			 ON
						 av.url = views.url
					 AND av.region = views.region
		WHERE views.total_views > 100
		  AND av.total_av > 40


	`;
};
