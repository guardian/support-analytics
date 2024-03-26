import { format, set, subHours } from "date-fns";
import type { Test } from "../lib/models";
import { Query } from "../lib/query";

const buildQuery = (test: Test, stage: "CODE" | "PROD"): Query => {
	const end = set(
		new Date(),
		{ minutes: 0, seconds: 0, milliseconds: 0 },
	);
	const start = subHours(end, 1);
	const endTimestamp = end.toISOString().replace("T", " ");
	const startTimestamp = start.toISOString().replace("T", " ");

	const query = `
		WITH views AS (
			SELECT
				ab.name test_name,
				ab.variant variant_name,
				COUNT(*) views
			FROM acquisition.epic_views_prod, UNNEST(abtests) t(ab)
			WHERE
			AND date_hour >= timestamp'${startTimestamp}' AND date_hour < timestamp'${endTimestamp}'
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
			WHERE acquisition_date >= date'${format(start, "yyyy-MM-dd")}'
			AND timestamp >= timestamp'${startTimestamp}' AND timestamp < timestamp'${endTimestamp}'
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

	return new Query(query, `query_${test.name}_${start.toISOString()}`);
};

export const getQueries = (
	tests: Test[],
	stage: "CODE" | "PROD"
): Array<[Test, Query]> => tests.map((test) => [test, buildQuery(test, stage)]);
