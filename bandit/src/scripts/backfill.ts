import * as dateFns from 'date-fns';
import { run as runQuery } from "../query-lambda/query-lambda";

/**
 * Runs the query and creates a Dynamodb row for every hour from START to now.
 * E.g.
 * START="2024-03-28T01:00:00.000Z" TEST_NAME="2024-03-05_EPIC_PRIMARY__US" yarn backfill
 */


const wait = () =>
	new Promise((resolve) => {
		setTimeout(resolve, 2000);
	});

const retry = (fn: () => Promise<void>, retries = 5): Promise<void> => {
	return fn().catch((err) => {
		console.log('Retrying...');
		if (retries > 0) {
			return wait().then(() => retry(fn, retries - 1));
		}
		throw err;
	});
}

const testName = process.env['TEST_NAME'] as string;
const start = process.env['START'] as string;
if (!testName || !start) {
	console.error('Required environment variables: TEST_NAME or START');
	process.exit(1);
}
const end = dateFns.set(new Date(), { minutes: 0, seconds: 0, milliseconds: 0 });

const dates: Date[] = [];
let date = new Date(start);
while (date < end) {
	date = dateFns.addHours(date, 1);
	dates.push(date);
}

const tests = [{ name: testName }];

const result = dates.reduce(
	(prev, date) => {
		return prev.then(() => {
			console.log('Running for date', date);
			return runQuery({tests, date})
				.then((result) => {
					console.log(result);
				})
				.catch((err) => {
					console.error(err);
				});
		});
	},
	Promise.resolve()
);

result.catch((err) => {
	console.log(err);
});
