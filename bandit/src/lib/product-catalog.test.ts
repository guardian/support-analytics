import {
	buildPricingCaseStatement,
	ProductCatalogService,
} from './product-catalog';

describe('ProductCatalogService', () => {
	const mockCatalogData = {
		SupporterPlus: {
			active: true,
			ratePlans: {
				Monthly: {
					billingPeriod: 'Month',
					pricing: {
						GBP: 12,
						USD: 15,
						AUD: 20,
						EUR: 12,
						NZD: 20,
						CAD: 15,
					},
				},
				Annual: {
					billingPeriod: 'Annual',
					pricing: {
						GBP: 120,
						USD: 150,
						AUD: 200,
						EUR: 120,
						NZD: 200,
						CAD: 150,
					},
				},
			},
		},
		DigitalSubscription: {
			active: true,
			ratePlans: {
				Monthly: {
					billingPeriod: 'Month',
					pricing: {
						GBP: 18,
						USD: 28,
						AUD: 30,
						EUR: 20,
						NZD: 30,
						CAD: 30,
					},
				},
				Quarterly: {
					billingPeriod: 'Quarter',
					pricing: {
						GBP: 44.94,
						USD: 74.94,
						AUD: 79.99,
						EUR: 56.19,
						NZD: 79.99,
						CAD: 82.31,
					},
				},
				Annual: {
					billingPeriod: 'Annual',
					pricing: {
						GBP: 180,
						USD: 280,
						AUD: 300,
						EUR: 200,
						NZD: 300,
						CAD: 300,
					},
				},
			},
		},
	};

	beforeEach(() => {
		global.fetch = jest.fn();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('fetchCatalog', () => {
		it('should fetch and parse product catalog successfully', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockCatalogData),
			});

			const service = new ProductCatalogService(
				'https://test-api.com/catalog.json',
			);
			await service.fetchCatalog();

			expect(global.fetch).toHaveBeenCalledWith(
				'https://test-api.com/catalog.json',
			);
		});

		it('should throw error if API request fails', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
			});

			const service = new ProductCatalogService(
				'https://test-api.com/catalog.json',
			);

			await expect(service.fetchCatalog()).rejects.toThrow(
				'Failed to fetch product catalog: 500 Internal Server Error',
			);
		});

		it('should throw error if catalog format is invalid', async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ invalid: 'data' }),
			});

			const service = new ProductCatalogService(
				'https://test-api.com/catalog.json',
			);

			await expect(service.fetchCatalog()).rejects.toThrow(
				'Invalid product catalog format',
			);
		});
	});

	describe('getPrice', () => {
		let service: ProductCatalogService;

		beforeEach(async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockCatalogData),
			});

			service = new ProductCatalogService(
				'https://test-api.com/catalog.json',
			);
			await service.fetchCatalog();
		});

		it('should return correct price for SUPPORTER_PLUS Monthly GBP', () => {
			const price = service.getPrice({
				product: 'SUPPORTER_PLUS',
				currency: 'GBP',
				billingPeriod: 'MONTHLY',
			});

			expect(price).toBe(12);
		});

		it('should return correct price for SUPPORTER_PLUS Annual USD', () => {
			const price = service.getPrice({
				product: 'SUPPORTER_PLUS',
				currency: 'USD',
				billingPeriod: 'ANNUALLY',
			});

			expect(price).toBe(150);
		});

		it('should return correct price for DIGITAL_SUBSCRIPTION Quarterly GBP', () => {
			const price = service.getPrice({
				product: 'DIGITAL_SUBSCRIPTION',
				currency: 'GBP',
				billingPeriod: 'QUARTERLY',
			});

			expect(price).toBe(44.94);
		});

		it('should throw error if catalog not loaded', () => {
			const newService = new ProductCatalogService(
				'https://test-api.com/catalog.json',
			);

			expect(() =>
				newService.getPrice({
					product: 'SUPPORTER_PLUS',
					currency: 'GBP',
					billingPeriod: 'MONTHLY',
				}),
			).toThrow('Product catalog not loaded');
		});

		it('should throw error for missing currency', () => {
			expect(() =>
				service.getPrice({
					product: 'SUPPORTER_PLUS',
					currency: 'JPY',
					billingPeriod: 'MONTHLY',
				}),
			).toThrow('Price not found for SupporterPlus Monthly in JPY');
		});
	});

	describe('buildPricingCaseStatement', () => {
		let service: ProductCatalogService;

		beforeEach(async () => {
			(global.fetch as jest.Mock).mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockCatalogData),
			});

			service = new ProductCatalogService(
				'https://test-api.com/catalog.json',
			);
			await service.fetchCatalog();
		});

		it('should generate valid SQL CASE statement', () => {
			const caseStatement = buildPricingCaseStatement(service);

			expect(caseStatement).toContain('CASE product');
			expect(caseStatement).toContain("WHEN 'SUPPORTER_PLUS' THEN");
			expect(caseStatement).toContain("WHEN 'DIGITAL_SUBSCRIPTION' THEN");
			expect(caseStatement).toContain("WHEN 'CONTRIBUTION' THEN amount");
			expect(caseStatement).toContain(
				"WHEN 'RECURRING_CONTRIBUTION' THEN amount",
			);
		});

		it('should include all currencies for SUPPORTER_PLUS', () => {
			const caseStatement = buildPricingCaseStatement(service);

			expect(caseStatement).toContain("WHEN 'GBP' THEN");
			expect(caseStatement).toContain("WHEN 'USD' THEN");
			expect(caseStatement).toContain("WHEN 'AUD' THEN");
			expect(caseStatement).toContain("WHEN 'EUR' THEN");
			expect(caseStatement).toContain("WHEN 'NZD' THEN");
			expect(caseStatement).toContain("WHEN 'CAD' THEN");
		});

		it('should include correct prices from catalog', () => {
			const caseStatement = buildPricingCaseStatement(service);

			expect(caseStatement).toContain("WHEN 'MONTHLY' THEN 12");
			expect(caseStatement).toContain("WHEN 'ANNUALLY' THEN 120");
			expect(caseStatement).toContain("WHEN 'QUARTERLY' THEN 44.94");
		});

		it('should include payment frequencies for DIGITAL_SUBSCRIPTION', () => {
			const caseStatement = buildPricingCaseStatement(service);

			const digitalSubSection = caseStatement.substring(
				caseStatement.indexOf("WHEN 'DIGITAL_SUBSCRIPTION'"),
			);

			expect(digitalSubSection).toContain("WHEN 'MONTHLY' THEN");
			expect(digitalSubSection).toContain("WHEN 'QUARTERLY' THEN");
			expect(digitalSubSection).toContain("WHEN 'ANNUALLY' THEN");
		});
	});
});
