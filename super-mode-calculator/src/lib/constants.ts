// How far back we look at acquistions + views when calculating super mode articles
export const SUPER_MODE_WINDOW_IN_HOURS = 3;

// How long should an article remain in super mode after entering
export const SUPER_MODE_DURATION_IN_HOURS = 24;

// Minimum views an article needs for it to be eligible for super mode
export const SUPER_MODE_MINIMUM_VIEWS = 100;

// Minimum av an article needs for it to be eligible for super mode
export const SUPER_MODE_MINIMUM_AV = 40;

export const SUPER_MODE_AV_PER_VIEWS_THRESHOLDS = {
	GB: 0.005,
	US: 0.033,
	AU: 0.01,
	NZ: 0.01,
	CA: 0.015,
	EU: 0.01,
	ROW: 0.01,
};
