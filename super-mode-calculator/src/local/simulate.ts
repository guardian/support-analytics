import { handler as calculateLambda } from '../lambdas/calculate/lambda';
import { handler as partitionLambda } from '../lambdas/partition/lambda';
import { handler as queryLambda } from '../lambdas/query/lambda';
import { retry } from './retry';

async function handler() {
	const date = new Date(Date.parse(process.env.SimDate ?? ''));

	const partitionExecutionIds = await partitionLambda();

	for (let hour = 0; hour < 24; hour++) {
		const dateWithHour = new Date(date.setHours(hour));
		console.log(dateWithHour);
		await retry(
			() => queryLambda(partitionExecutionIds, dateWithHour),
			5,
		).then((queryExecutionIds) =>
			retry(() => calculateLambda(queryExecutionIds, dateWithHour), 5),
		);
	}
}

void handler();
