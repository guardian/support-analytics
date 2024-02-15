import {Query} from "./query";

export interface Test {
	name: string;
	launchDate: string;
	endDate: string;
}

const buildQuery = (test: Test, stage: 'CODE' | 'PROD'): Query => {
	const dateHourString = `${test.launchDate} 00:00:00`;
	const query = `
	  WITH epic_views AS (
	      SELECT ab_test_name, ab_test_variant, COUNT(*) AS views
		  FROM epic_views_${stage.toLowerCase()}
		  WHERE date_hour >= TIMESTAMP '${dateHourString}' ),
	      GROUP BY 1,2
	  ),
	  acqs AS (
	      SELECT ab_test_name, ab_test_variant, SUM(annualisedValueGBP) AS total_av
		  FROM acquisition_events_${stage.toLowerCase()}
		  WHERE acquisition_date >= DATE '${test.launchDate}'
	  )
	  SELECT
	      epic_views.ab_test_name,
	      epic_views.ab_test_variant,
	      (acqs.total_av / epic_views.views)*1000 AS av_per_1000_views
	  FROM epic_views
	  INNER JOIN acqs USING (ab_test_name, ab_test_variant)
	`;

	return new Query(query, `query_${test.name}`);
};

export const getQueries = (tests: Test[], stage: 'CODE' | 'PROD'): [Test,Query][] =>
	tests.map(test => [test, buildQuery(test, stage)]);
