import { handler as calculateLambda } from '../lambdas/calculate/lambda';
import { handler as partitionLambda } from '../lambdas/partition/lambda';
import { handler as queryLambda } from '../lambdas/query/lambda';
import { retry } from './retry';

function handler() {
	return partitionLambda()
		.then((executionIds) => {
			return retry(() => queryLambda(executionIds), 5);
		})
		.then((executionIds) => {
			return retry(() => calculateLambda(executionIds), 5);
		});
}

void handler();
