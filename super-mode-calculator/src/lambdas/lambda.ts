import { BigQuery } from '@google-cloud/bigquery';
import { buildAuthClient } from '../lib/bigquery';
import { getSSMParam } from '../lib/ssm';

const stage = process.env.STAGE;

export async function handler(): Promise<void> {
	if (stage !== 'CODE' && stage !== 'PROD') {
		return Promise.reject(`Invalid stage: ${stage ?? ''}`);
	}

	console.log('Simple Lambda For Super mode calculator');

	const gcpConfig = await getSSMParam('gcp-wif-credentials-config', stage);

	const authClient = await buildAuthClient(gcpConfig);

	const bigquery = new BigQuery({
		projectId: `datatech-platform-${stage.toLowerCase()}`,
		authClient,
	});

	const query =
		'select * from `datatech-platform-prod.datalake.fact_acquisition_event` limit 10';
	console.log('Running query: ', query);
	const rows = await bigquery.query(query);

	console.log('Query results: ', rows);

	return;
}
