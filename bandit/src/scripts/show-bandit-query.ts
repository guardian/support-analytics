import {
	buildPricingCaseStatement,
	createProductCatalogService,
} from '../lib/product-catalog';
import {
	buildTestSpecificQuery,
	buildTotalComponentViewsQuery,
} from '../query-lambda/build-query';

const CHANNELS = [
	'Epic',
	'Banner1',
	'Banner2',
	'SupportLandingPage',
	'OneTimeCheckout',
] as const;

async function showGeneratedQuery() {
	console.log('Fetching product catalog from CODE environment...\n');

	const catalogService = createProductCatalogService('CODE');
	await catalogService.fetchCatalog();

	console.log('Product catalog fetched successfully!\n');

	const pricingCaseStatement = buildPricingCaseStatement(catalogService);

	const start = new Date('2026-02-18T00:00:00.000Z');
	const end = new Date('2026-02-18T01:00:00.000Z');

	for (const channel of CHANNELS) {
		const testConfig = { name: `TestBandit_${channel}`, channel };

		console.log('='.repeat(80));
		console.log(`QUERY FOR CHANNEL: ${channel}`);
		console.log('='.repeat(80));

		const query = buildTestSpecificQuery(
			testConfig,
			'PROD',
			start,
			end,
			pricingCaseStatement,
		);

		console.log(query);
		console.log();
	}

	const mixedChannels = ['Banner1', 'SupportLandingPage'];
	console.log('='.repeat(80));
	console.log(
		`TOTAL VIEWS QUERY FOR MIXED CHANNELS: ${mixedChannels.join(', ')}`,
	);
	console.log('='.repeat(80));

	const totalViewsQuery = buildTotalComponentViewsQuery(
		mixedChannels,
		'PROD',
		start,
		end,
	);

	console.log(totalViewsQuery);
	console.log();
}

showGeneratedQuery().catch((error) => {
	console.error('Error:', error);
	process.exit(1);
});
