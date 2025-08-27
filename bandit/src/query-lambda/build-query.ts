import { format, subDays } from "date-fns";
import type { BanditTestConfig } from "../lib/models";

const ANNUALISED_VALUE_CAP = 250;

type Channel = "Epic" | "Banner1" | "Banner2";
const ComponentTypeMapping: Record<Channel, string> = {
	Epic: "ACQUISITIONS_EPIC",
	Banner1: "ACQUISITIONS_ENGAGEMENT_BANNER",
	Banner2: "ACQUISITIONS_SUBSCRIPTIONS_BANNER",
};

const getComponentType = (channel: string): string => {
	return ComponentTypeMapping[channel as Channel];
};

const formatTimestamps = (start: Date, end: Date) => ({
	startTimestamp: start.toISOString().replace("T", " "),
	endTimestamp: end.toISOString().replace("T", " "),
});

export const buildTotalComponentViewsQuery = (
	channel: string,
	stage: "CODE" | "PROD",
	start: Date,
	end: Date
): string => {
	const { startTimestamp, endTimestamp } = formatTimestamps(start, end);
	const componentType = getComponentType(channel);

	return `
SELECT
	COUNT(*) as total_views_for_component_type
FROM datatech-platform-${stage.toLowerCase()}.online_traffic.fact_page_view_anonymised
CROSS JOIN UNNEST(component_event_array) as ce
WHERE received_date >= DATE_SUB('${format(
		start,
		"yyyy-MM-dd"
	)}', INTERVAL 1 DAY)
AND received_date <= '${format(start, "yyyy-MM-dd")}'
AND ce.event_timestamp >= '${startTimestamp}'
AND ce.event_timestamp < '${endTimestamp}'
AND ce.event_action = "VIEW"
AND ce.component_type = "${componentType}"
	`;
};

export const buildTestSpecificQuery = (
	test: BanditTestConfig,
	stage: "CODE" | "PROD",
	start: Date,
	end: Date
): string => {
	const { startTimestamp, endTimestamp } = formatTimestamps(start, end);
	const dateForCurrencyConversionTable = subDays(start, 1); //This table is updated daily  but has a lag of 1 day
	const componentType = getComponentType(test.channel);

	return `
WITH exchange_rates AS (
    SELECT target, date, (1/rate) AS reverse_rate FROM datatech-platform-${stage.toLowerCase()}.datalake.fixer_exchange_rates
	WHERE date = '${format(dateForCurrencyConversionTable, "yyyy-MM-dd")}'),
gbp_rate AS (
	SELECT
	 rate, date
	FROM  datatech-platform-${stage.toLowerCase()}.datalake.fixer_exchange_rates
	WHERE target = 'GBP' AND  date = '${format(
		dateForCurrencyConversionTable,
		"yyyy-MM-dd"
	)}'),
acquisitions AS (
    SELECT
      ab.name AS  test_name,
      ab.variant AS variant_name,
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
                WHEN 'ANNUALLY' THEN 200
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
        END
        AS amount,
      product,
      currency,
      payment_frequency,
    FROM datatech-platform-${stage.toLowerCase()}.datalake.fact_acquisition_event AS acq
    CROSS JOIN UNNEST(ab_tests) AS ab
    WHERE event_timestamp >= timestamp '${startTimestamp}' AND event_timestamp <  timestamp '${endTimestamp}'
    AND component_type = "${componentType}"
    AND name = '${test.name}'
),
acqusitions_with_av AS (
  SELECT
    acq.*,
    date,
    CASE payment_frequency
      WHEN 'ONE_OFF' THEN amount * exch.reverse_rate
      WHEN 'MONTHLY' THEN (amount * exch.reverse_rate)*12
      WHEN 'ANNUALLY' THEN amount * exch.reverse_rate
      END
    AS av_eur,
    exch.reverse_rate
  FROM acquisitions AS acq
  JOIN exchange_rates AS exch ON acq.currency = exch.target
),
acqusitions_with_av_gbp AS(
  SELECT
	acq_av.*,
	CASE acq_av.currency
		WHEN 'GBP' THEN av_eur
		ELSE av_eur * (gbp_rate.rate)
		END
	AS av_gbp
	FROM acqusitions_with_av AS acq_av
	JOIN  gbp_rate  ON acq_av.date = gbp_rate.date
	),
acquisitions_agg AS (
  SELECT
    test_name,
    variant_name,
    SUM(IF( av_gbp >= ${ANNUALISED_VALUE_CAP}, ${ANNUALISED_VALUE_CAP},  av_gbp)) sum_av_gbp,
    COUNT(*) acquisitions
  FROM acqusitions_with_av_gbp
  GROUP BY 1,2
),
views AS (
  SELECT
    ce.ab_test_name AS test_name,
    ce.ab_test_variant AS variant_name,
    COUNT(*) views
  FROM datatech-platform-${stage.toLowerCase()}.online_traffic.fact_page_view_anonymised
  CROSS JOIN UNNEST(component_event_array) as ce
  -- Include previous day, as a pageview's received_date may be before midnight and a component_event after
  WHERE received_date >= DATE_SUB('${format(
		start,
		"yyyy-MM-dd"
  )}', INTERVAL 1 DAY) AND received_date <= '${format(start, "yyyy-MM-dd")}'
  AND ce.event_timestamp >= '${startTimestamp}' AND ce.event_timestamp < '${endTimestamp}'
  AND ce.event_action = "VIEW"
  AND ce.component_type =  "${componentType}"
  AND ce.ab_test_name = '${test.name}'
  GROUP BY 1,2
)
SELECT
	COALESCE(views.test_name, '${test.name}') as test_name,
	COALESCE(views.variant_name, 'NO_VARIANT') as variant_name,
	COALESCE(views.views, 0) as views,
	COALESCE(acquisitions_agg.sum_av_gbp, 0) AS sum_av_gbp,
	SAFE_DIVIDE(COALESCE(acquisitions_agg.sum_av_gbp, 0), COALESCE(views.views, 0)) AS sum_av_gbp_per_view,
	COALESCE(acquisitions_agg.acquisitions,0) AS acquisitions
FROM views
FULL OUTER JOIN acquisitions_agg USING (test_name, variant_name)
-- Ensure at least one row is returned even if no views or acquisitions
WHERE views.test_name IS NOT NULL OR acquisitions_agg.test_name IS NOT NULL

UNION ALL

-- If there are no views for this specific test, return a default row
SELECT
    '${test.name}' as test_name,
    'NO_VARIANT' as variant_name,
    0 as views,
    0 AS sum_av_gbp,
    0 AS sum_av_gbp_per_view,
    0 AS acquisitions
WHERE NOT EXISTS (SELECT 1 FROM views)
AND NOT EXISTS (SELECT 1 FROM acquisitions_agg)
	`;
};
