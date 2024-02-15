import {run} from "./query-lambda";

const tests = [
	{
		name: 'test1',
		launchDate: '2024-02-01',
		endDate: '2024-02-10'
	}
]

run(tests)
	.then(result => {
		console.log(result);
	})
 	.catch(err => {
		console.log(err);
	});
