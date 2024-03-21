module.exports = {
	extends: ["@guardian/eslint-config-typescript"],
	parserOptions: {
		project: "tsconfig.json",
		tsconfigRootDir: __dirname,
		sourceType: "module",
	},
};
