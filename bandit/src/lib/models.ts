interface ABTestMethodology {
	name: 'ABTest';
}
interface EpsilonGreedyBanditMethodology {
	name: 'EpsilonGreedyBandit';
	epsilon: number;
}
interface RouletteMethodology {
	name: 'Roulette';
}
// each methodology may have an optional testName, which should be used for tracking
export type Methodology = { testName?: string } & (
	| ABTestMethodology
	| EpsilonGreedyBanditMethodology
	| RouletteMethodology
);

export interface Test {
	name: string;
	channel: string;
	methodologies?: Methodology[];
}

export interface BanditTestConfig {
	name: string; // this may be specific to the methodology, e.g. MY_TEST_EpsilonGreedyBandit-0.5
	channel: string;
}
