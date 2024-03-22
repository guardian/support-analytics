import { run as runCalculate } from "../calculate-lambda/calculate-lambda";
import { run as runQuery } from "./query-lambda";

const tests = [
	{
		name: "2024-03-05_EPIC_PRIMARY__US",
		launchDate: "2024-03-15",
	},
];

const wait = () =>
	new Promise((resolve) => {
		setTimeout(resolve, 12000);
	});

// const meanStream = fs.createWriteStream('./means.csv', {flags: 'a'});

// let dates = [];
// let date = new Date('2024-02-16');
// while (date < new Date('2024-02-20')) {
// 	date = dateFns.addHours(date, 1);
// 	dates.push(date);
// }
//
// Promise.all(
// 	dates.map(date =>
// 		runQuery(tests, date.toISOString().replace('T', ' '))
// 			.then(async result => {
// 				await wait();
// 				return result;
// 			})
// 			.then(result => {
// 				return runCalculate(result);
// 			})
// 			.then(rows => {
// 				rows.forEach(row => meanStream.write(`${date.toISOString()},${row.variant},${(row.av_gbp / row.views)*1000}\n`));
// 			})
// 	)
// ).catch(err => {
// 	console.log(err);
// });

runQuery(tests)
	.then(async (result) => {
		await wait();
		return result;
	})
	.then((result) => {
		return runCalculate(result);
	})
	.then((result) => {
		console.log(result);
	})
	.catch((err) => {
		console.error(err);
	});
