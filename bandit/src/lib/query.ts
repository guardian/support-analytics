export class Query {
	query: string;
	token: string;

	constructor(q: string, name: string) {
		this.query = q;
		this.token = `${name}_${new Date().toISOString()}`;
	}
}
