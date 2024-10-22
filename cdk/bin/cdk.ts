import 'source-map-support/register';
import { GuRoot } from '@guardian/cdk/lib/constructs/root';
import { Bandit } from '../lib/bandit';
import {SuperModeCalculator} from "../lib/super-mode-calculator";

const app = new GuRoot();
new Bandit(app, 'Bandit-CODE', {
	stack: 'support',
	stage: 'CODE',
	env: { region: 'eu-west-1' },
});
new Bandit(app, 'Bandit-PROD', {
	stack: 'support',
	stage: 'PROD',
	env: { region: 'eu-west-1' },
});
new SuperModeCalculator(app,'SuperModeCalculator-CODE',{
	stack: 'support',
	stage: 'CODE',
	env: { region: 'eu-west-1' },
})
new SuperModeCalculator(app,'SuperModeCalculator-PROD',{
	stack: 'support',
	stage: 'PROD',
	env: { region: 'eu-west-1' },
})
