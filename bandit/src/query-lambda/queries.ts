import { format } from "date-fns";
import type { Test } from "../lib/models";
import { Query } from "../lib/query";

// TODO - rewrite query to use real data to get sum of views and sum of AV GBP
const buildQuery = (test: Test, date: Date, stage: "CODE" | "PROD"): Query => {
	const timestamp = date.toISOString().replace("T", " ");
	const query = `
		WITH views AS (
			SELECT
				ab.name test_name,
				ab.variant variant_name,
				COUNT(*) views
			FROM acquisition.epic_views_prod, UNNEST(abtests) t(ab)
			WHERE date_hour >= timestamp'${timestamp}'
			AND ab.name = '${test.name}'
			GROUP BY 1,2
		),
		acquisitions AS (
			SELECT
				ab.name test_name,
				ab.variant variant_name,
				SUM(annualisedvaluegbp) av_gbp,
				COUNT(*) acquisitions
			FROM acquisition.acquisition_events_prod, UNNEST(abtests) t(ab)
			WHERE acquisition_date >= date'${format(date, "yyyy-MM-dd")}'
			AND timestamp >= timestamp'${timestamp}'
			AND ab.name = '${test.name}'
			GROUP BY 1,2
		)
		SELECT
		    test_name,
			variant_name,
			views,
			av_gbp / views,
			acquisitions
		FROM views
		JOIN acquisitions USING (test_name, variant_name)
	`;

	return new Query(query, `query_${test.name}_${date.toISOString()}`);
};

export const getQueries = (
	tests: Test[],
	dateHourString: Date,
	stage: "CODE" | "PROD"
): Array<[Test, Query]> =>
	tests.map((test) => [test, buildQuery(test, dateHourString, stage)]);
