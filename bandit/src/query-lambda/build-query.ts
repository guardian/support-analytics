import { format, subDays } from 'date-fns';
import type { BanditTestConfig } from '../lib/models';

const ANNUALISED_VALUE_CAP = 250;

type ComponentChannel = 'Epic' | 'Banner1' | 'Banner2';
const ComponentTypeMapping: Record<ComponentChannel, string> = {
	Epic: 'ACQUISITIONS_EPIC',
	Banner1: 'ACQUISITIONS_ENGAGEMENT_BANNER',
	Banner2: 'ACQUISITIONS_SUBSCRIPTIONS_BANNER',
};

const getComponentType = (channel: string): string => {
	return ComponentTypeMapping[channel as ComponentChannel];
};

const isLandingPageTest = (test: BanditTestConfig): boolean => {
	// Landing page tests are identified by specific channels (DynamoDB)
	return (
		test.channel === 'SupportLandingPage' ||
		test.channel === 'OneTimeCheckout'
	);
};

// Helper function to get the correct path filter for landing page channels (BigQuery)
const getLandingPagePathFilter = (channel: string): string => {
	switch (channel) {
		case 'SupportLandingPage':
			return "path LIKE '%/contribute'";
		case 'OneTimeCheckout':
			return "path LIKE '%/one-time-checkout'";
		default:
			return "path LIKE '%/contribute'"; // fallback
	}
};

const formatTimestamps = (start: Date, end: Date) => ({
	startTimestamp: start.toISOString().replace('T', ' '),
	endTimestamp: end.toISOString().replace('T', ' '),
});

const buildComponentViewsQuery = (
	componentChannels: string[],
	stage: 'CODE' | 'PROD',
	start: Date,
	startTimestamp: string,
	endTimestamp: string,
): string => `
SELECT COUNT(*) as total_views
FROM datatech-platform-${stage.toLowerCase()}.online_traffic.fact_page_view_anonymised
CROSS JOIN UNNEST(component_event_array) as ce
WHERE received_date >= DATE_SUB('${format(start, 'yyyy-MM-dd')}', INTERVAL 1 DAY)
AND received_date <= '${format(start, 'yyyy-MM-dd')}'
AND ce.event_timestamp >= '${startTimestamp}'
AND ce.event_timestamp < '${endTimestamp}'
AND ce.event_action = "VIEW"
AND ce.component_type IN (${componentChannels.map((c) => `"${getComponentType(c)}"`).join(', ')})`;

export const buildTotalComponentViewsQuery = (
	channels: string[],
	stage: 'CODE' | 'PROD',
	start: Date,
	end: Date,
): string => {
	const { startTimestamp, endTimestamp } = formatTimestamps(start, end);

	const landingPageChannels = ['SupportLandingPage', 'OneTimeCheckout'];
	const hasLandingPages = channels.some((channel) =>
		landingPageChannels.includes(channel),
	);

	// If we have landing page tests, we need to query both component_event_array and ab_test_array
	if (hasLandingPages) {
		const componentChannels = channels.filter(
			(channel) => !landingPageChannels.includes(channel),
		);
		const componentQuery =
			componentChannels.length > 0
				? buildComponentViewsQuery(
						componentChannels,
						stage,
						start,
						startTimestamp,
						endTimestamp,
					)
				: '';

		// Create separate queries for each landing page channel type
		const landingPageQueries: string[] = [];
		const landingPageChannelsInUse = channels.filter((channel) =>
			landingPageChannels.includes(channel),
		);

		landingPageChannelsInUse.forEach((channel) => {
			landingPageQueries.push(`
SELECT COUNT(*) as total_views
FROM datatech-platform-${stage.toLowerCase()}.online_traffic.fact_page_view_anonymised
CROSS JOIN UNNEST(ab_test_array) as ab
WHERE received_date >= DATE_SUB('${format(
				start,
				'yyyy-MM-dd',
			)}', INTERVAL 1 DAY)
AND received_date <= '${format(start, 'yyyy-MM-dd')}'
AND host = 'support.theguardian.com'
AND ${getLandingPagePathFilter(channel)}`);
		});

		const allQueries = componentQuery
			? [componentQuery, ...landingPageQueries]
			: landingPageQueries;

		// Combine all queries with UNION ALL
		if (allQueries.length > 1) {
			return `SELECT SUM(total_views) as total_views FROM (${allQueries.join(' UNION ALL ')})`;
		} else if (allQueries.length === 1) {
			return allQueries[0];
		} else {
			return 'SELECT 0 as total_views';
		}
	}

	// Original logic for component-only tests
	return buildComponentViewsQuery(
		channels,
		stage,
		start,
		startTimestamp,
		endTimestamp,
	);
};

const buildExchangeRatesCtes = (stage: 'CODE' | 'PROD', date: Date): string => `
WITH exchange_rates AS (
    SELECT target, date, (1/rate) AS reverse_rate FROM datatech-platform-${stage.toLowerCase()}.datalake.fixer_exchange_rates
	WHERE date = '${format(date, 'yyyy-MM-dd')}'),
gbp_rate AS (
	SELECT
	 rate, date
	FROM  datatech-platform-${stage.toLowerCase()}.datalake.fixer_exchange_rates
	WHERE target = 'GBP' AND  date = '${format(date, 'yyyy-MM-dd')}'),`;

const buildAcquisitionsCte = (
	stage: 'CODE' | 'PROD',
	startTimestamp: string,
	endTimestamp: string,
	testName: string,
	pricingCaseStatement: string,
	componentTypeFilter?: string,
): string => {
	const componentTypeClause = componentTypeFilter
		? `\n    AND component_type = "${componentTypeFilter}"`
		: '';
	return `
acquisitions AS (
    SELECT
      ab.name AS  test_name,
      ab.variant AS variant_name,
      ${pricingCaseStatement}
        AS amount,
      product,
      currency,
      payment_frequency,
    FROM datatech-platform-${stage.toLowerCase()}.datalake.fact_acquisition_event AS acq
    CROSS JOIN UNNEST(ab_tests) AS ab
    WHERE event_timestamp >= timestamp '${startTimestamp}' AND event_timestamp <  timestamp '${endTimestamp}'${componentTypeClause}
    AND name = '${testName}'
),`;
};

const buildAvAndAggCtes = (): string => `
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
),`;

const buildLandingPageViewsCte = (
	stage: 'CODE' | 'PROD',
	start: Date,
	channel: string,
	testName: string,
): string => `
views AS (
  SELECT
    ab.ab_test_name AS test_name,
    ab.ab_test_variant AS variant_name,
    COUNT(*) views
  FROM datatech-platform-${stage.toLowerCase()}.online_traffic.fact_page_view_anonymised
  CROSS JOIN UNNEST(ab_test_array) as ab
  -- Include previous day, as a pageview's received_date may be before midnight and an ab_test after
  WHERE received_date >= DATE_SUB('${format(start, 'yyyy-MM-dd')}', INTERVAL 1 DAY) AND received_date <= '${format(start, 'yyyy-MM-dd')}'
  AND host = 'support.theguardian.com'
  AND ${getLandingPagePathFilter(channel)}
  AND ab.ab_test_name = '${testName}'
  GROUP BY 1,2
)`;

const buildComponentViewsCte = (
	stage: 'CODE' | 'PROD',
	start: Date,
	startTimestamp: string,
	endTimestamp: string,
	componentType: string,
	testName: string,
): string => `
views AS (
  SELECT
    ce.ab_test_name AS test_name,
    ce.ab_test_variant AS variant_name,
    COUNT(*) views
  FROM datatech-platform-${stage.toLowerCase()}.online_traffic.fact_page_view_anonymised
  CROSS JOIN UNNEST(component_event_array) as ce
  -- Include previous day, as a pageview's received_date may be before midnight and a component_event after
  WHERE received_date >= DATE_SUB('${format(start, 'yyyy-MM-dd')}', INTERVAL 1 DAY) AND received_date <= '${format(start, 'yyyy-MM-dd')}'
  AND ce.event_timestamp >= '${startTimestamp}' AND ce.event_timestamp < '${endTimestamp}'
  AND ce.event_action = "VIEW"
  AND ce.component_type =  "${componentType}"
  AND ce.ab_test_name = '${testName}'
  GROUP BY 1,2
)`;

const buildFinalSelect = (): string => `
SELECT
	views.test_name,
	views.variant_name,
	views.views,
	COALESCE(acquisitions_agg.sum_av_gbp, 0) AS sum_av_gbp,
	SAFE_DIVIDE(COALESCE(acquisitions_agg.sum_av_gbp, 0), views.views) AS sum_av_gbp_per_view,
	COALESCE(acquisitions_agg.acquisitions,0) AS acquisitions
FROM views
LEFT JOIN acquisitions_agg USING (test_name, variant_name)`;

const buildLandingPageTestQuery = (
	test: BanditTestConfig,
	stage: 'CODE' | 'PROD',
	start: Date,
	end: Date,
	pricingCaseStatement: string,
): string => {
	const { startTimestamp, endTimestamp } = formatTimestamps(start, end);
	const date = subDays(start, 1); //This table is updated daily but has a lag of 1 day
	return (
		buildExchangeRatesCtes(stage, date) +
		buildAcquisitionsCte(
			stage,
			startTimestamp,
			endTimestamp,
			test.name,
			pricingCaseStatement,
		) +
		buildAvAndAggCtes() +
		buildLandingPageViewsCte(stage, start, test.channel, test.name) +
		buildFinalSelect()
	);
};

const buildComponentTestQuery = (
	test: BanditTestConfig,
	stage: 'CODE' | 'PROD',
	start: Date,
	end: Date,
	pricingCaseStatement: string,
): string => {
	const { startTimestamp, endTimestamp } = formatTimestamps(start, end);
	const date = subDays(start, 1); //This table is updated daily but has a lag of 1 day
	const componentType = getComponentType(test.channel);
	return (
		buildExchangeRatesCtes(stage, date) +
		buildAcquisitionsCte(
			stage,
			startTimestamp,
			endTimestamp,
			test.name,
			pricingCaseStatement,
			componentType,
		) +
		buildAvAndAggCtes() +
		buildComponentViewsCte(
			stage,
			start,
			startTimestamp,
			endTimestamp,
			componentType,
			test.name,
		) +
		buildFinalSelect()
	);
};

export const buildTestSpecificQuery = (
	test: BanditTestConfig,
	stage: 'CODE' | 'PROD',
	start: Date,
	end: Date,
	pricingCaseStatement: string,
): string =>
	isLandingPageTest(test)
		? buildLandingPageTestQuery(
				test,
				stage,
				start,
				end,
				pricingCaseStatement,
			)
		: buildComponentTestQuery(
				test,
				stage,
				start,
				end,
				pricingCaseStatement,
			);
