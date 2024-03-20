import 'source-map-support/register';
import { GuRoot } from '@guardian/cdk/lib/constructs/root';
import { Bandit } from '../lib/bandit';

const app = new GuRoot();
new Bandit(app, 'Bandit-CODE', {
	stack: 'deploy',
	stage: 'CODE',
	env: { region: 'eu-west-1' },
});
new Bandit(app, 'Bandit-PROD', {
	stack: 'deploy',
	stage: 'PROD',
	env: { region: 'eu-west-1' },
});
