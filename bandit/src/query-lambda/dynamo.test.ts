import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { buildWriteRequest, writeBatch } from './dynamo';
import type { DocumentWriteRequest } from './dynamo';
import type { VariantQueryRow } from './parse-result';

jest.mock('@aws-sdk/lib-dynamodb', () => ({
	BatchWriteCommand: jest.fn((input: unknown) => ({ input })),
}));

describe('writeBatch', () => {
	let sendMock: jest.Mock;
	let mockDocClient: { send: jest.Mock };

	beforeEach(() => {
		sendMock = jest.fn().mockResolvedValue({ $metadata: {} });
		mockDocClient = { send: sendMock };
	});

	function createItem(i: number): DocumentWriteRequest {
		return {
			PutRequest: {
				Item: {
					testName: `test${i}`,
					variants: [],
					timestamp: '2024-01-01',
				},
			},
		};
	}

	it('should write all items in a single batch when under 25', async () => {
		const items = Array.from({ length: 10 }, (_, i) => createItem(i));

		await writeBatch(
			items,
			'PROD',
			mockDocClient as unknown as DynamoDBDocumentClient,
		);

		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it('should chunk items into multiple batches when over 25', async () => {
		const items = Array.from({ length: 28 }, (_, i) => createItem(i));

		await writeBatch(
			items,
			'PROD',
			mockDocClient as unknown as DynamoDBDocumentClient,
		);

		expect(sendMock).toHaveBeenCalledTimes(2);
	});

	it('should chunk exactly 25 items into one batch', async () => {
		const items = Array.from({ length: 25 }, (_, i) => createItem(i));

		await writeBatch(
			items,
			'PROD',
			mockDocClient as unknown as DynamoDBDocumentClient,
		);

		expect(sendMock).toHaveBeenCalledTimes(1);
	});

	it('should chunk 26 items into two batches', async () => {
		const items = Array.from({ length: 26 }, (_, i) => createItem(i));

		await writeBatch(
			items,
			'PROD',
			mockDocClient as unknown as DynamoDBDocumentClient,
		);

		expect(sendMock).toHaveBeenCalledTimes(2);
	});

	it('should use correct table name with stage', async () => {
		const items = [createItem(1)];

		await writeBatch(
			items,
			'staging',
			mockDocClient as unknown as DynamoDBDocumentClient,
		);

		const callArgs = (sendMock.mock.calls[0] as [unknown])[0] as {
			input: { RequestItems: Record<string, unknown[]> };
		};
		expect(
			callArgs.input.RequestItems['support-bandit-STAGING'],
		).toBeDefined();
	});
});

describe('buildWriteRequest', () => {
	it('should build a valid write request', () => {
		const rows: VariantQueryRow[] = [
			{
				test_name: 'test1',
				variant_name: 'control',
				views: 100,
				sum_av_gbp: 50,
				sum_av_gbp_per_view: 0.5,
				acquisitions: 10,
			},
		];

		const result = buildWriteRequest(rows, 'test1', 'Epic', '2024-01-01');

		expect(result.PutRequest.Item).toEqual({
			testName: 'Epic_test1',
			variants: [
				{
					variantName: 'control',
					annualisedValueInGBP: 50,
					annualisedValueInGBPPerView: 0.5,
					views: 100,
				},
			],
			timestamp: '2024-01-01',
		});
	});
});
