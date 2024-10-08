import { run as runQuery } from "./query-lambda";

const tests = [
	{
		name: "2024-03-05_EPIC_PRIMARY__US",
		channel: "Epic",
		launchDate: "2024-03-15",
	},
];

const wait = () =>
	new Promise((resolve) => {
		setTimeout(resolve, 12000);
	});

runQuery({tests})
	.then(async (result) => {
		await wait();
		return result;
	})
	.then((result) => {
		console.log(result);
	})
	.catch((err) => {
		console.error(err);
	});
