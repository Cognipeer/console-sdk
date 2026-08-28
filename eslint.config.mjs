import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'docs/.vitepress/cache/**',
      'docs/.vitepress/dist/**',
    ],
  },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    linterOptions: {
      // ESLint 9 flat config defaults this to 'warn'; eslintrc defaulted it off.
      // Kept off so this upgrade introduces no lint-policy drift. Flip to 'warn'
      // to surface stale eslint-disable directives (currently 1, in src/resources/browser.ts).
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // caughtErrors: 'none' preserves typescript-eslint v6 behaviour. v8 changed the
      // default to 'all', which flags intentional `catch (e)` blocks (currently 1, in
      // src/http.ts). Drop this option to adopt the stricter v8 default.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];
