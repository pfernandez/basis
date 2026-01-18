import js from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';

const maxLenRule = [
  'error',
  {
    code: 80,
    ignoreUrls: true,
    ignoreStrings: true,
    ignoreTemplateLiterals: true,
    ignoreRegExpLiterals: true,
  },
];

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'docs/**', '*.out'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
    },
    plugins: { jsdoc },
    settings: {
      jsdoc: { mode: 'typescript' },
    },
    rules: {
      'max-len': maxLenRule,
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'jsdoc/check-param-names': 'error',
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-types': 'error',
      'jsdoc/require-param': 'error',
      'jsdoc/require-returns': 'error',
    },
  },
  {
    files: ['src/**/*.js'],
    rules: {
      'jsdoc/require-jsdoc': ['error', { contexts: ['FunctionDeclaration'] }],
    },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      'jsdoc/require-param': 'off',
      'jsdoc/require-returns': 'off',
    },
  },
  {
    files: ['src/**/*.js', 'tests/**/*.js', '*.js'],
    ignores: ['src/vis/**'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['src/vis/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['src/catalan/colorize.js'],
    rules: {
      'no-control-regex': 'off',
    },
  },
  {
    files: ['src/vis/domain/**/*.js'],
    rules: {
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'fetch',
      ],
    },
  },
];
