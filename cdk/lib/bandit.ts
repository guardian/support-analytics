import { GuAlarm } from '@guardian/cdk/lib/constructs/cloudwatch';
import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import { GuLambdaFunction } from '@guardian/cdk/lib/constructs/lambda';
import { type App, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { ComparisonOperator, Metric } from 'aws-cdk-lib/aws-cloudwatch';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Rule, RuleTargetInput, Schedule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import {
	DefinitionBody,
	Errors,
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
				initialPolicy: [
					new PolicyStatement({
						actions: ['dynamodb:Query'],
						resources: [
							`arn:aws:dynamodb:eu-west-1:${this.account}:table/support-admin-console-channel-tests-${this.stage}`,
						],
					}),
				],
			},
		);

		const getBanditTestsTask = new LambdaInvoke(
			this,
			'get-bandit-tests-task',
			{
				lambdaFunction: getBanditTestsLambda,
			},
		);

		const banditsTable = new Table(this, 'bandits-table', {
			tableName: `support-bandit-${this.stage}`,
			removalPolicy: RemovalPolicy.RETAIN,
			billingMode: BillingMode.PAY_PER_REQUEST,
			partitionKey: {
				name: 'testName',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'timestamp',
				type: AttributeType.STRING,
			},
			pointInTimeRecovery: this.stage === 'PROD',
			timeToLiveAttribute: 'ttlInSeconds',
		});

		const queryLambdaRole = new Role(this, 'query-lambda-role', {
			// Set the name of the role rather than using an autogenerated name.
			// This is in preparation for the migration to BigQuery, because if the ARN is too long then it breaks the authentication request to GCP
			roleName: `bandit-query-${this.stage}`,
			assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
		});
		queryLambdaRole.addToPolicy(
			new PolicyStatement({
				actions: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
				],
				resources: ['*'],
			}),
		);
		queryLambdaRole.addToPolicy(
			new PolicyStatement({
				actions: ['ssm:GetParameter'],
				resources: [
					`arn:aws:ssm:${this.region}:${this.account}:parameter/bandit-testing/${this.stage}/gcp-wif-credentials-config`,
				],
			}),
		);

		queryLambdaRole.addToPolicy(
			new PolicyStatement({
				actions: ['dynamodb:BatchWriteItem'],
				resources: [banditsTable.tableArn],
			}),
		);

		const queryLambda = new GuLambdaFunction(this, 'query-lambda', {
			app: appName,
			functionName: `${appName}-query-${this.stage}`,
			runtime: Runtime.NODEJS_20_X,
			handler: 'query-lambda/query-lambda.run',
			fileName: `${appName}.zip`,
			timeout: Duration.seconds(60),
			role: queryLambdaRole,
		});

		const queryTask = new LambdaInvoke(this, 'query-task', {
			lambdaFunction: queryLambda,
			inputPath: '$.Payload',
		});

		const stateMachine = new StateMachine(this, 'state-machine', {
			stateMachineName: `${appName}-${this.stage}`,
			definitionBody: DefinitionBody.fromChainable(
				getBanditTestsTask
					.next(
						queryTask.addRetry({
							errors: [Errors.ALL],
							interval: Duration.minutes(2),
							maxAttempts: 5,
							backoffRate: 2,
						}),
					)
					.next(new Succeed(this, 'state-machine-success')),
			),
		});

		new Rule(this, `${appName}Startup`, {
			enabled: true,
			targets: [
				new SfnStateMachine(stateMachine, {
					input: RuleTargetInput.fromObject({}),
				}),
			],
			schedule: Schedule.cron({ minute: '15' }),
			ruleName: `${appName}-startup-${this.stage}`,
		});
		// Alarms
		const isProd = this.stage === 'PROD';

		new GuAlarm(this, 'TimeoutAlarm', {
			app: appName,
			actionsEnabled: isProd,
			snsTopicName: `alarms-handler-topic-${this.stage}`,
			alarmName: `Support Bandit Timeout in ${this.stage}.`,
			alarmDescription: `There was a timeout whilst setting up bandit data. Check https://eu-west-1.console.aws.amazon.com/states/home?region=eu-west-1#/statemachines/view/arn%3Aaws%3Astates%3Aeu-west-1%3A865473395570%3AstateMachine%3Asupport-bandit-${this.stage}?statusFilter=TIMED_OUT`,
			metric: new Metric({
				metricName: 'ExecutionsTimedOut',
				namespace: 'AWS/States',
				dimensionsMap: {
					StateMachineArn: stateMachine.stateMachineArn,
				},
				statistic: 'Sum',
				period: Duration.seconds(60),
			}),
			comparisonOperator:
				ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
			evaluationPeriods: 1,
			threshold: 1,
		}).node.addDependency(stateMachine);

		new GuAlarm(this, 'ExecutionFailureAlarm', {
			app: appName,
			actionsEnabled: isProd,
			snsTopicName: `alarms-handler-topic-${this.stage}`,
			alarmName: `Execution Failure in Support Bandit ${this.stage}.`,
			alarmDescription: `There was a failure whilst setting up support bandit data . Check https://eu-west-1.console.aws.amazon.com/states/home?region=eu-west-1#/statemachines/view/arn%3Aaws%3Astates%3Aeu-west-1%3A865473395570%3AstateMachine%3Asupport-bandit-${this.stage}?statusFilter=FAILED`,
			metric: new Metric({
				metricName: 'ExecutionsFailed',
				namespace: 'AWS/States',
				dimensionsMap: {
					StateMachineArn: stateMachine.stateMachineArn,
				},
				statistic: 'Sum',
				period: Duration.seconds(60),
			}),
			comparisonOperator:
				ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
			evaluationPeriods: 1,
			threshold: 1,
		}).node.addDependency(stateMachine);
	}
}
