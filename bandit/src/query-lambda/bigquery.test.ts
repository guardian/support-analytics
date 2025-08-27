import { BigQuery } from "@google-cloud/bigquery";
import type { BaseExternalAccountClient } from "google-auth-library";
import type { BanditTestConfig } from "../lib/models";
import {
	clearTotalComponentViewsCache,
	getDataForBanditTest,
} from "./bigquery";
import {
	mergeQueryResults,
	parseTestSpecificResult,
	parseTotalComponentViewsResult,
} from "./parse-result";

// Mock BigQuery
jest.mock("@google-cloud/bigquery");
const MockedBigQuery = BigQuery as jest.MockedClass<typeof BigQuery>;

// Mock parse functions
jest.mock("./parse-result", () => ({
	parseTotalComponentViewsResult: jest.fn(),
	parseTestSpecificResult: jest.fn(),
	mergeQueryResults: jest.fn(),
}));

const mockParseTotalComponentViewsResult =
	parseTotalComponentViewsResult as jest.MockedFunction<
		typeof parseTotalComponentViewsResult
	>;
const mockParseTestSpecificResult =
	parseTestSpecificResult as jest.MockedFunction<
		typeof parseTestSpecificResult
	>;
const mockMergeQueryResults = mergeQueryResults as jest.MockedFunction<
	typeof mergeQueryResults
>;

describe("bigquery memoization", () => {
	let mockAuthClient: BaseExternalAccountClient;
	let mockBigQueryInstance: Partial<BigQuery>;
	let mockQuery: jest.Mock;

	beforeEach(() => {
		clearTotalComponentViewsCache();

		mockQuery = jest.fn();
		mockBigQueryInstance = {
			query: mockQuery,
		};

		MockedBigQuery.mockImplementation(
			() => mockBigQueryInstance as BigQuery
		);

		mockAuthClient = {} as BaseExternalAccountClient;

		// Setup default mocks
		mockParseTotalComponentViewsResult.mockReturnValue({
			total_views_for_component_type: 1000,
		});
		mockParseTestSpecificResult.mockReturnValue([
			{
				test_name: "TestName",
				variant_name: "control",
				views: 100,
				sum_av_gbp: 10.5,
				sum_av_gbp_per_view: 0.105,
				acquisitions: 5,
			},
		]);
		mockMergeQueryResults.mockReturnValue([
			{
				test_name: "TestName",
				variant_name: "control",
				views: 100,
				sum_av_gbp: 10.5,
				sum_av_gbp_per_view: 0.105,
				acquisitions: 5,
				total_views_for_component_type: 1000,
			},
		]);

		mockQuery.mockResolvedValue([[]]);
	});

	afterEach(() => {
		jest.clearAllMocks();
		clearTotalComponentViewsCache();
	});

	it("should cache total component views for the same parameters", async () => {
		const testConfig: BanditTestConfig = {
			name: "TestName",
			channel: "Epic",
		};
		const start = new Date("2023-01-01T00:00:00.000Z");

		// First call
		await getDataForBanditTest(mockAuthClient, "PROD", testConfig, start);

		// Second call with same parameters
		await getDataForBanditTest(mockAuthClient, "PROD", testConfig, start);

		// Should only call query 3 times: once for total component views, twice for test specific queries
		expect(mockQuery).toHaveBeenCalledTimes(3);

		// Should call parseTotalComponentViewsResult only once (cached)
		expect(mockParseTotalComponentViewsResult).toHaveBeenCalledTimes(1);

		// Should call parseTestSpecificResult twice (not cached)
		expect(mockParseTestSpecificResult).toHaveBeenCalledTimes(2);
	});

	it("should not cache total component views for different parameters", async () => {
		const testConfig1: BanditTestConfig = {
			name: "TestName",
			channel: "Epic",
		};
		const testConfig2: BanditTestConfig = {
			name: "TestName",
			channel: "Banner1",
		};
		const start = new Date("2023-01-01T00:00:00.000Z");

		// First call with Epic channel
		await getDataForBanditTest(mockAuthClient, "PROD", testConfig1, start);

		// Second call with Banner1 channel (different component type)
		await getDataForBanditTest(mockAuthClient, "PROD", testConfig2, start);

		// Should call query 4 times: twice for total component views (different channels), twice for test specific queries
		expect(mockQuery).toHaveBeenCalledTimes(4);

		// Should call parseTotalComponentViewsResult twice (different cache keys)
		expect(mockParseTotalComponentViewsResult).toHaveBeenCalledTimes(2);

		// Should call parseTestSpecificResult twice
		expect(mockParseTestSpecificResult).toHaveBeenCalledTimes(2);
	});
});
