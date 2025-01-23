import {GuScheduledLambda} from "@guardian/cdk";
import type { GuStackProps } from '@guardian/cdk/lib/constructs/core';
import { GuStack } from '@guardian/cdk/lib/constructs/core';
import {type App, Duration, RemovalPolicy} from 'aws-cdk-lib';
import {AttributeType, BillingMode, ProjectionType, Table} from "aws-cdk-lib/aws-dynamodb";
import { Schedule } from 'aws-cdk-lib/aws-events';
import { PolicyStatement, Role, ServicePrincipal} from 'aws-cdk-lib/aws-iam';
import { Runtime } from 'aws-cdk-lib/aws-lambda';

const appName = 'super-mode';
export class SuperModeCalculator extends GuStack {
	constructor(scope: App, id: string, props: GuStackProps) {
		super(scope, id, props);

		const scheduleRules = [
					{
						schedule: Schedule.rate(Duration.minutes(60)),
					},
				]

		const superModeCalculatorTable = new Table(this, 'super-mode-calculator-table', {
			tableName: `super-mode-calculator-${this.stage}`,
			removalPolicy: RemovalPolicy.RETAIN,
			billingMode: BillingMode.PROVISIONED,
			partitionKey: {
				name: 'id',
				type: AttributeType.STRING,
			},
			sortKey: {
				name: 'startTimestamp',
				type: AttributeType.STRING,
			},
			readCapacity: 5,
			writeCapacity: 5,
			pointInTimeRecovery: this.stage === 'PROD',
		});

		superModeCalculatorTable.addGlobalSecondaryIndex({
			indexName: 'end',
			partitionKey: { name: "endDate", type: AttributeType.STRING},
			sortKey: { name: "endTimestamp", type: AttributeType.STRING},
			projectionType: ProjectionType.ALL,
			readCapacity: 5,
			writeCapacity: 5,
		});


		const role = new Role(this, 'query-lambda-role', {
			// Set the name of the role rather than using an autogenerated name.
			// This is because if the ARN is too long then it breaks the authentication request to GCP
			roleName: `${appName}-${this.stage}`,
			assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
		});
		role.addToPolicy(
			// Logging permissions
			new PolicyStatement({
				actions: [
					'logs:CreateLogGroup',
					'logs:CreateLogStream',
					'logs:PutLogEvents',
				],
				resources: ['*'],
			}),
		);
		role.addToPolicy(
			// Permission to read config from Parameter Store
			new PolicyStatement({
				actions: ['ssm:GetParameter'],
				resources: [
					`arn:aws:ssm:${this.region}:${this.account}:parameter/super-mode/${this.stage}/gcp-wif-credentials-config`,
				],
			}),
		);
		role.addToPolicy(
			new PolicyStatement({
				actions: ['dynamodb:Query'],
				resources: [
					`arn:aws:dynamodb:eu-west-1:${this.account}:table/super-mode-calculator-${this.stage}`,
					`arn:aws:dynamodb:eu-west-1:${this.account}:table/super-mode-calculator-${this.stage}/index/*`
				],
			}),
		);
		role.addToPolicy(
				new PolicyStatement({
					actions: ['dynamodb:BatchWriteItem'],
					resources: [superModeCalculatorTable.tableArn],
				}),
		);

		new GuScheduledLambda(this, 'SuperModeCalculator', {
			app: appName,
			functionName: `${appName}-${this.stage}`,
			runtime: Runtime.NODEJS_20_X,
			handler: 'lambdas/lambda.handler',
			fileName: `${appName}.zip`,
			rules: scheduleRules,
			role,
			timeout: Duration.minutes(2),
			monitoringConfiguration:
				this.stage === 'PROD'
					? {
						toleratedErrorPercentage: 0,
						snsTopicName: 'alarms-handler-topic-PROD',
					}
					: { noMonitoring: true },
		});
	}
}
