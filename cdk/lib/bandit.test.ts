import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { Bandit } from './bandit';

describe('The Bandit stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new Bandit(app, 'Bandit', {
			stack: 'deploy',
			stage: 'TEST',
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
