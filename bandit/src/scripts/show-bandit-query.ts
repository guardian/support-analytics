import {
	buildPricingCaseStatement,
	createProductCatalogService,
} from '../lib/product-catalog';
import { buildTestSpecificQuery } from '../query-lambda/build-query';

async function showGeneratedQuery() {
	console.log('Fetching product catalog from CODE environment...\n');

	const catalogService = createProductCatalogService('CODE');
	await catalogService.fetchCatalog();

	console.log('Product catalog fetched successfully!\n');
	console.log('='.repeat(80));
	console.log('GENERATED PRICING CASE STATEMENT:');
	console.log('='.repeat(80));

	const pricingCaseStatement = buildPricingCaseStatement(catalogService);
	console.log(pricingCaseStatement);

	console.log('\n' + '='.repeat(80));
	console.log('FULL BIGQUERY SQL:');
	console.log('='.repeat(80));

	const testConfig = { name: 'TestBandit', channel: 'Epic' };
	const start = new Date('2026-02-18T00:00:00.000Z');
	const end = new Date('2026-02-18T01:00:00.000Z');

	const fullQuery = buildTestSpecificQuery(
		testConfig,
		'PROD',
		start,
		end,
		pricingCaseStatement,
	);

	console.log(fullQuery);
	console.log('\n' + '='.repeat(80));
}

showGeneratedQuery().catch((error) => {
	console.error('Error:', error);
	process.exit(1);
});
