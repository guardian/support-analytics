interface ABTestMethodology {
	name: 'ABTest';
}
interface EpsilonGreedyBanditMethodology {
	name: 'EpsilonGreedyBandit';
	epsilon: number;
}
export type Methodology = ABTestMethodology | EpsilonGreedyBanditMethodology;

export interface Test {
	name: string;
	channel: string;
	methodologies?: Methodology[];
}
