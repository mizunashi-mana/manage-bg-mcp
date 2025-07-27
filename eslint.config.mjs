import { defineConfig } from 'eslint/config';
import eslintCommentsConfig from './eslint/eslint-comments.config.mjs';
import globalsConfig from './eslint/globals.config.mjs';
import importsConfig from './eslint/imports.config.mjs';
import jsConfig from './eslint/js.config.mjs';
import nodeConfig from './eslint/node.config.mjs';
import pluginsConfig from './eslint/plugins.config.mjs';
import promiseConfig from './eslint/promise.config.mjs';
import tsConfig from './eslint/ts.config.mjs';

export default defineConfig([
  globalsConfig,
  pluginsConfig,
  eslintCommentsConfig,
  promiseConfig,
  nodeConfig,
  importsConfig,
  jsConfig,
  tsConfig,
  {
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'max-lines': 'off',
      'no-console': 'off',
    },
  },
]);
