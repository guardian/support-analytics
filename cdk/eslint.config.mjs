import guardian from '@guardian/eslint-config';

export default [
	...guardian.configs.recommended,
	...guardian.configs.jest,
	{
		ignores: ['**/*.js', 'cdk.out', 'jest.config.js'],
	},
	{
		rules: {
			'@typescript-eslint/no-inferrable-types': 'off',
			'import/no-namespace': 'error',
		},
	},
];
