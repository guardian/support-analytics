import {Query} from "../lib/query";

export interface Test {
	name: string;
	launchDate: string;
	endDate: string;
}

const buildQuery = (test: Test, dateHourString: string, stage: 'CODE' | 'PROD'): Query => {
	const query = `
		WITH views AS (
			SELECT test, variant, SUM(views) AS views FROM mab_test_views
			WHERE hour <= timestamp'${dateHourString}'
			AND test = '${test.name}'
		    GROUP BY 1,2
		),
		acqs AS (
			SELECT test, variant, SUM(av_gbp) AS av_gbp FROM mab_test_acquisitions
			WHERE hour <= timestamp'${dateHourString}'
		    AND test = '${test.name}'
		    GROUP BY 1,2
		)
		SELECT * FROM views
		JOIN acqs USING (test,variant)
	`;

	return new Query(query, `query_${test.name}_${dateHourString}`);
};

export const getQueries = (tests: Test[], dateHourString: string, stage: 'CODE' | 'PROD'): [Test,Query][] =>
	tests.map(test => [test, buildQuery(test, dateHourString, stage)]);
