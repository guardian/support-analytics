
export type PaymentFrequency =
	| 'ONE_OFF'
	| 'MONTHLY'
	| 'ANNUALLY'
	| 'QUARTERLY'
	| 'SIX_MONTHLY';

export const  acquisitionProduct= {
	Contribution : "CONTRIBUTION",
	RecurringContribution :"RECURRING_CONTRIBUTION",
	SupporterPlus : "SUPPORTER_PLUS",
	TierThree : "TIER_THREE",
	DigitalSubscription : "DIGITAL_SUBSCRIPTION",
	Paper : "PRINT_SUBSCRIPTION",
	GuardianWeekly : "PRINT_SUBSCRIPTION",
	AppPremiumTier : "APP_PREMIUM_TIER",
} as const;

type AcquisitionProduct = typeof acquisitionProduct[keyof typeof acquisitionProduct];

export interface AcquisitionData {
	amount: number;
	product: AcquisitionProduct;
	currency: string;
	paymentFrequency: PaymentFrequency;
}
