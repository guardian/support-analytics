import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { type App, RemovalPolicy } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import {
	DefinitionBody,
	StateMachine,
	Succeed,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';

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
				handler: 'get-bandit-tests/get-bandit-tests.run',
				fileName: `${appName}.zip`,
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
			handler: 'query-lambda/query-lambda.run',
			fileName: `${appName}.zip`,
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
			handler: 'calculate-lambda/calculate-lambda.run',
			fileName: `${appName}.zip`,
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

		new StateMachine(this, 'state-machine', {
			stateMachineName: `${appName}-${this.stage}`,
			definitionBody: DefinitionBody.fromChainable(
				getBanditTestsTask
					.next(queryTask)
					.next(calculateTask)
					.next(new Succeed(this, 'state-machine-success')),
			),
		});
	}
}
