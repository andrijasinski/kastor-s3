import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
	{
		ignores: ['**/dist/**', '**/node_modules/**'],
	},
	{
		files: ['api/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'shared/**/*.ts'],
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			import: importX,
			'unused-imports': unusedImports,
		},
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// @typescript-eslint rules
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/no-unsafe-function-type': 'error',
			'@typescript-eslint/no-wrapper-object-types': 'error',
			'@typescript-eslint/only-throw-error': 'error',
			'@typescript-eslint/prefer-promise-reject-errors': 'error',
			'@typescript-eslint/explicit-member-accessibility': 'error',
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'default',
					format: ['camelCase'],
					leadingUnderscore: 'allow',
					trailingUnderscore: 'allow',
				},
				{
					selector: 'import',
					format: ['camelCase', 'PascalCase'],
				},
				{
					selector: 'variable',
					format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
					leadingUnderscore: 'allow',
				},
				{
					selector: 'typeLike',
					format: ['PascalCase'],
				},
				{
					selector: 'enumMember',
					format: ['UPPER_CASE'],
				},
				// Object literal properties may be PascalCase (e.g. AWS SDK input params like Bucket, Prefix)
				{
					selector: 'objectLiteralProperty',
					format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
					leadingUnderscore: 'allow',
				},
			],
			'@typescript-eslint/no-shadow': 'error',
			'@typescript-eslint/unbound-method': 'error',
			'@typescript-eslint/no-base-to-string': 'error',
			'@typescript-eslint/return-await': 'error',
			'@typescript-eslint/require-array-sort-compare': 'error',
			'@typescript-eslint/prefer-find': 'error',

			// import rules
			'import/no-default-export': 'error',

			// unused imports
			'unused-imports/no-unused-imports': 'error',

			// core rules
			curly: 'error',
			eqeqeq: 'error',
			'no-console': 'error',
			'no-debugger': 'error',
			'no-restricted-syntax': [
				'error',
				{
					selector: 'ForInStatement',
					message: 'Use for..of or Object.entries() instead of for..in.',
				},
				{
					selector: 'LabeledStatement',
					message: 'Labeled statements are not allowed.',
				},
				{
					selector: 'WithStatement',
					message: 'with statements are not allowed.',
				},
			],
			'id-match': ['error', '^[a-zA-Z_][a-zA-Z0-9_]*$'],
		},
	},
	// Config files may use default exports
	{
		files: ['**/*.config.ts', '**/*.config.mts', '**/*.config.js', '**/*.config.mjs'],
		rules: {
			'import/no-default-export': 'off',
		},
	},
	// Must be last: disables ESLint rules that would conflict with Prettier
	prettier,
	// Re-enable after prettier overrides
	{
		files: ['api/src/**/*.ts', 'frontend/src/**/*.{ts,tsx}', 'shared/**/*.ts'],
		rules: {
			curly: 'error',
		},
	},
);
