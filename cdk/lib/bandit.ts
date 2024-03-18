import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { RemovalPolicy, type App } from 'aws-cdk-lib';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { StateMachine, Succeed } from 'aws-cdk-lib/aws-stepfunctions';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';

const appName = 'support-bandit';

export class Bandit extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);

		const getBanditTestsLambda = new GuLambdaFunction(
			this,
			'get-bandit-tests',
			{
				app: appName,
				functionName: `${appName}-get-bandit-tests-${this.stage}`,
				runtime: Runtime.NODEJS_20_X,
				handler: '',
				fileName: `${appName}-get-bandit-tests.zip`,
			},
		);

		const getBanditTestsTask = new LambdaInvoke(
			this,
			'get-bandit-tests-task',
			{
				lambdaFunction: getBanditTestsLambda,
			},
		);

		const queryLambda = new GuLambdaFunction(this, 'query-lambda', {
			app: appName,
			functionName: `${appName}-query-${this.stage}`,
			runtime: Runtime.NODEJS_20_X,
			handler: '',
			fileName: `${appName}-query.zip`,
		});

		const queryTask = new LambdaInvoke(this, 'query-task', {
			lambdaFunction: queryLambda,
		});

		const banditsTable = new Table(this, 'bandits-table', {
			tableName: `support-bandit-${this.stage}`,
			removalPolicy: RemovalPolicy.RETAIN,
			billingMode: BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'testNameWithAlgorithm',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: AttributeType.STRING,
			},
			pointInTimeRecovery: this.stage === 'PROD',
			timeToLiveAttribute: 'ttlInSeconds',
		});

		const calculateLambda = new GuLambdaFunction(this, 'calculate-lambda', {
			app: appName,
			functionName: `${appName}-calculate-${this.stage}`,
			runtime: Runtime.NODEJS_20_X,
			handler: '',
			fileName: `${appName}-calculate.zip`,
			initialPolicy: [
				new PolicyStatement({
					actions: ['dynamodb:BatchWriteItem'],
					resources: [banditsTable.tableArn],
				}),
			],
		});

		const calculateTask = new LambdaInvoke(this, 'calculate-task', {
			lambdaFunction: calculateLambda,
		});

		const stateMachine = new StateMachine(this, 'state-machine', {
			stateMachineName: `${appName}-${this.stage}`,
			definition: getBanditTestsTask
				.next(queryTask)
				.next(calculateTask)
				.next(new Succeed(this, 'state-machine-success')),
		});
	}
}
