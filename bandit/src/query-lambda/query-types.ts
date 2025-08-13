export interface TotalComponentViewsResult {
	total_views_for_component_type: number;
}

export interface TestSpecificResult {
	test_name: string;
	variant_name: string;
	views: number;
	sum_av_gbp: number;
	sum_av_gbp_per_view: number;
	acquisitions: number;
}
