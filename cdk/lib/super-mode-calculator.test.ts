import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import {SuperModeCalculator} from "./super-mode-calculator";

describe('The SuperModeCalculator stack', () => {
	it('matches the snapshot', () => {
		const app = new App();
		const stack = new SuperModeCalculator(app, 'SuperModeCalculator', {
			stack: 'support',
			stage: 'TEST',
		});
		const template = Template.fromStack(stack);
		expect(template.toJSON()).toMatchSnapshot();
	});
});
