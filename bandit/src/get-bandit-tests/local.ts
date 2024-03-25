import { run } from "./get-bandit-tests";

run()
	.then((tests) => console.log(tests))
	.catch((e) => console.log(e));
