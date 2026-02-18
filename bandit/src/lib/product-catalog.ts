/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime checks needed for Record type lookups which can return undefined */
import { z } from 'zod';

const RatePlanSchema = z.object({
	billingPeriod: z.string().optional(),
	pricing: z.record(z.string(), z.number()),
});

const ProductSchema = z.object({
	active: z.boolean(),
	ratePlans: z.record(z.string(), RatePlanSchema),
});

const ProductCatalogSchema = z.record(z.string(), ProductSchema);

export type ProductCatalog = z.infer<typeof ProductCatalogSchema>;
export type RatePlan = z.infer<typeof RatePlanSchema>;

export interface PriceQuery {
	product: string;
	currency: string;
	billingPeriod: string;
}

const PRODUCT_NAME_MAP: Record<string, string | undefined> = {
	SUPPORTER_PLUS: 'SupporterPlus',
	DIGITAL_SUBSCRIPTION: 'DigitalSubscription',
};

const BILLING_PERIOD_MAP: Record<string, string | undefined> = {
	MONTHLY: 'Monthly',
	ANNUALLY: 'Annual',
	QUARTERLY: 'Quarterly',
};

export class ProductCatalogService {
	private catalog: ProductCatalog | null = null;

	constructor(private readonly apiUrl: string) {}

	async fetchCatalog(): Promise<void> {
		try {
			const response = await fetch(this.apiUrl);

			if (!response.ok) {
				throw new Error(
					`Failed to fetch product catalog: ${response.status} ${response.statusText}`,
				);
			}

			const data: unknown = await response.json();
			this.catalog = ProductCatalogSchema.parse(data);
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new Error(
					`Invalid product catalog format: ${error.message}`,
				);
			}
			throw error;
		}
	}

	getPrice(query: PriceQuery): number {
		if (this.catalog === null) {
			throw new Error(
				'Product catalog not loaded. Call fetchCatalog() first.',
			);
		}

		const productName = PRODUCT_NAME_MAP[query.product];
		if (productName === undefined) {
			throw new Error(
				`Unknown product: ${
					query.product
				}. Expected one of: ${Object.keys(PRODUCT_NAME_MAP).join(
					', ',
				)}`,
			);
		}

		// Runtime check needed: Zod record types don't guarantee key existence at runtime
		const product = this.catalog[productName];
		if (product === undefined) {
			throw new Error(`Product not found in catalog: ${productName}`);
		}

		const billingPeriod = BILLING_PERIOD_MAP[query.billingPeriod];
		if (billingPeriod === undefined) {
			throw new Error(
				`Unknown billing period: ${
					query.billingPeriod
				}. Expected one of: ${Object.keys(BILLING_PERIOD_MAP).join(
					', ',
				)}`,
			);
		}

		// Runtime check needed: Zod record types don't guarantee key existence at runtime
		const ratePlan = product.ratePlans[billingPeriod];
		if (ratePlan === undefined) {
			throw new Error(
				`Rate plan not found for ${productName} with billing period ${billingPeriod}`,
			);
		}

		// Runtime check needed: Zod record types don't guarantee key existence at runtime
		const price = ratePlan.pricing[query.currency];
		if (price === undefined) {
			throw new Error(
				`Price not found for ${productName} ${billingPeriod} in ${query.currency}`,
			);
		}

		return price;
	}

	getAllPrices(
		product: string,
		currencies: string[],
		billingPeriods: string[],
	): Map<string, Map<string, number>> {
		const result = new Map<string, Map<string, number>>();

		for (const currency of currencies) {
			const currencyPrices = new Map<string, number>();

			for (const billingPeriod of billingPeriods) {
				try {
					const price = this.getPrice({
						product,
						currency,
						billingPeriod,
					});
					currencyPrices.set(billingPeriod, price);
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					console.warn(
						`Price not available for ${product} ${currency} ${billingPeriod}: ${errorMessage}`,
					);
				}
			}

			if (currencyPrices.size > 0) {
				result.set(currency, currencyPrices);
			}
		}

		return result;
	}
}

export function createProductCatalogService(
	stage: 'CODE' | 'PROD',
): ProductCatalogService {
	const baseUrl =
		stage === 'PROD'
			? 'https://product-catalog.guardianapis.com'
			: 'https://product-catalog.code.dev-guardianapis.com';

	return new ProductCatalogService(`${baseUrl}/product-catalog.json`);
}

export function buildPricingCaseStatement(
	catalogService: ProductCatalogService,
): string {
	const products = ['SUPPORTER_PLUS', 'DIGITAL_SUBSCRIPTION'];
	const currencies = ['GBP', 'USD', 'AUD', 'EUR', 'NZD', 'CAD'];
	const billingPeriods: Record<string, string[]> = {
		SUPPORTER_PLUS: ['MONTHLY', 'ANNUALLY'],
		DIGITAL_SUBSCRIPTION: ['MONTHLY', 'QUARTERLY', 'ANNUALLY'],
	};

	const productCases: string[] = [];

	for (const product of products) {
		const currencyCases: string[] = [];

		for (const currency of currencies) {
			// Fallback to empty array if product not in map
			const periods = billingPeriods[product] || [];
			const periodCases: string[] = [];

			for (const period of periods) {
				try {
					const price = catalogService.getPrice({
						product,
						currency,
						billingPeriod: period,
					});
					periodCases.push(
						`                WHEN '${period}' THEN ${price}`,
					);
				} catch (error) {
					console.warn(
						`Skipping ${product} ${currency} ${period}: price not available`,
					);
				}
			}

			if (periodCases.length > 0) {
				currencyCases.push(`            WHEN '${currency}' THEN
              CASE payment_frequency
${periodCases.join('\n')}
                END`);
			}
		}

		if (currencyCases.length > 0) {
			productCases.push(`        WHEN '${product}' THEN
          CASE currency
${currencyCases.join('\n')}
            END`);
		}
	}

	return `CASE product
${productCases.join('\n')}
        WHEN 'CONTRIBUTION' THEN amount
        WHEN 'RECURRING_CONTRIBUTION' THEN amount
        END`;
}
