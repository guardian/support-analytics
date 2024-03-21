export class InvalidConfigError extends Error {
	name = 'InvalidConfigError';
	message = 'Invalid config';
}

export class QueryExecutionNotFoundError extends Error {
	name = 'QueryExecutionNotFoundError';
	message = 'Query execution not found';
}

export class QueryPendingError extends Error {
	name = 'QueryPendingError';
	message = 'Query pending';
}

export class QueryFailedError extends Error {
	name = 'QueryFailedError';
	message = 'Query failed';
}

export class QueryReturnedInvalidDataError extends Error {
	name = 'QueryReturnedInvalidDataError';
	message = 'Query returned invalid data';
}
