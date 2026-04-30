import js from "@eslint/js";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
	{
		ignores: [
			"dist/**",
			"node_modules/**",
			"src-tauri/target/**",
			"src-tauri/gen/**",
			"coverage/**",
			"*.min.js",
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.{ts,tsx}"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.browser,
				...globals.es2022,
			},
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
		},
		plugins: {
			react,
			"react-hooks": reactHooks,
			"react-refresh": reactRefresh,
		},
		settings: {
			react: { version: "detect" },
		},
		rules: {
			...react.configs.recommended.rules,
			...reactHooks.configs.recommended.rules,
			"react/react-in-jsx-scope": "off",
			"react/jsx-uses-react": "off",
			"react/prop-types": "off",
			"react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
				},
			],
			"@typescript-eslint/no-explicit-any": "warn",
		},
	},
	{
		files: ["**/*.{test,spec}.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
	{
		files: ["playwright.config.ts"],
		languageOptions: {
			globals: {
				...globals.node,
			},
		},
	},
	{
		files: ["scripts/**/*.{js,mjs,cjs}"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				...globals.node,
			},
		},
	},
	prettierConfig,
);
