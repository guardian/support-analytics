import {format, subDays} from "date-fns";
import type {Test} from "../lib/models";
import {Query} from "../lib/query";


const ANNUALISED_VALUE_CAP = 250;
export const buildQuery = (
	test: Test,
	stage: "CODE" | "PROD",
	start: Date,
	end: Date,
): Query => {
	const endTimestamp = end.toISOString().replace("T", " ");
	const startTimestamp = start.toISOString().replace("T", " ");
	const dateForCurrencyConversionTable = subDays(start, 1); //This table is updated daily  but has a lag of 1 day
	const query = `
WITH exchange_rates AS (
    SELECT target, (1/rate) AS reverse_rate from datatech-platform-prod.datalake.fixer_exchange_rates
	WHERE date = '${format(dateForCurrencyConversionTable, "yyyy-MM-dd")}'),
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
        AS amount,
      product,
      currency,
      payment_frequency,
    FROM datatech-platform-prod.datalake.fact_acquisition_event AS acq
    CROSS JOIN UNNEST(ab_tests) AS ab
    WHERE event_timestamp >= timestamp '${startTimestamp}' AND event_timestamp <  timestamp '${endTimestamp}'
    AND component_type = "ACQUISITIONS_EPIC"
    AND name = '${test.name}'
),
acqusitions_with_av AS (
  SELECT
    acq.*,
    CASE payment_frequency
      WHEN 'ONE_OFF' THEN amount * exch.reverse_rate
      WHEN 'MONTHLY' THEN (amount * exch.reverse_rate)*12
      WHEN 'ANNUAL' THEN amount * exch.reverse_rate
      END
    AS av_eur,
    exch.reverse_rate
  FROM acquisitions AS acq
  JOIN exchange_rates AS exch ON acq.currency = exch.target
),
acquisitions_agg AS (
  SELECT
    test_name,
    variant_name,
    SUM(IF( av_eur >= ${ANNUALISED_VALUE_CAP}, ${ANNUALISED_VALUE_CAP},  av_eur)) sum_av_eur,
    COUNT(*) acquisitions
  FROM acqusitions_with_av
  GROUP BY 1,2
),
views AS (
  SELECT
    ce.ab_test_name AS test_name,
    ce.ab_test_variant AS variant_name,
    COUNT(*) views
  FROM datatech-platform-prod.online_traffic.fact_page_view
  CROSS JOIN UNNEST(component_event_array) as ce
  WHERE received_date = '${format(start, "yyyy-MM-dd")}'
  AND ce.event_action = "VIEW"
  AND ce.component_type = "ACQUISITIONS_EPIC"
  AND ce.ab_test_name = '${test.name}'
  GROUP BY 1,2
)
SELECT
	views.test_name,
	views.variant_name,
	views.views,
	COALESCE(acquisitions_agg.sum_av_eur, 0) AS sum_av_eur,
	SAFE_DIVIDE(COALESCE(acquisitions_agg.sum_av_eur, 0), views.views) AS sum_av_eur_per_view ,
	COALESCE(acquisitions_agg.acquisitions,0) AS acquisitions
FROM views
		 LEFT JOIN acquisitions_agg
				   USING (test_name, variant_name)
	`;
	return new Query(query, `${test.name}_${start.toISOString()}`);

}
