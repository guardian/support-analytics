import type { SimpleQueryRowsResponse } from "@google-cloud/bigquery";
import { QueryReturnedInvalidDataError } from "../lib/errors";
import {
	buildTestSpecificQuery,
	buildTotalComponentViewsQuery,
} from "./build-query";
import {
	parseTotalComponentViewsResult, parseVariantQueryRows
} from "./parse-result";

describe("build-query functions", () => {
	const testConfig = { name: "TestName", channel: "Epic" };
	const stage = "PROD" as const;
	const start = new Date("2023-01-01T00:00:00.000Z");
	const end = new Date("2023-01-01T01:00:00.000Z");

	describe("buildTotalComponentViewsQuery", () => {
		it("should build a query for total component views", () => {
			const query = buildTotalComponentViewsQuery(
				["Epic"],
				stage,
				start,
				end
			);

			expect(query).toContain(
				"COUNT(*) as total_views"
			);
			expect(query).toContain("ACQUISITIONS_EPIC");
			expect(query).toContain("datatech-platform-prod");
			expect(query).toContain("2023-01-01 00:00:00.000");
			expect(query).toContain("2023-01-01 01:00:00.000");
		});
	});

	describe("buildTestSpecificQuery", () => {
		it("should build a query for test specific data", () => {
			const query = buildTestSpecificQuery(testConfig, stage, start, end);

			expect(query).toContain("TestName");
			expect(query).toContain("ACQUISITIONS_EPIC");
			expect(query).toContain("datatech-platform-prod");
			expect(query).toContain("2023-01-01 00:00:00.000");
			expect(query).toContain("2023-01-01 01:00:00.000");
			expect(query).not.toContain("total_component_views AS");
		});
	});
});

describe("parse-result functions", () => {
	describe("parseTotalComponentViewsResult", () => {
		it("should parse total component views result", () => {
			const mockResult: SimpleQueryRowsResponse = [
				[{ total_views: 1000 }],
				{},
			];

			const result = parseTotalComponentViewsResult(mockResult);

			expect(result).toEqual({ total_views: 1000 });
		});

		it("should throw error for invalid result", () => {
			const mockResult: SimpleQueryRowsResponse = [
				[{ invalid_field: 1000 }],
				{},
			];

			expect(() => parseTotalComponentViewsResult(mockResult)).toThrow(
				QueryReturnedInvalidDataError
			);
		});
	});

	describe("parseTestSpecificResult", () => {
		it("should parse test specific result", () => {
			const mockResult: SimpleQueryRowsResponse = [
				[
					{
						test_name: "TestName",
						variant_name: "control",
						views: 100,
						sum_av_gbp: 10.5,
						sum_av_gbp_per_view: 0.105,
						acquisitions: 5,
					},
				],
				{},
			];

			const result = parseVariantQueryRows(mockResult);

			expect(result).toEqual([
				{
					test_name: "TestName",
					variant_name: "control",
					views: 100,
					sum_av_gbp: 10.5,
					sum_av_gbp_per_view: 0.105,
					acquisitions: 5,
				},
			]);
		});

		it("should throw error for invalid result", () => {
			const mockResult: SimpleQueryRowsResponse = [
				[{ invalid_field: "value" }],
				{},
			];

			expect(() => parseVariantQueryRows(mockResult)).toThrow(
				QueryReturnedInvalidDataError
			);
		});
	});
});
