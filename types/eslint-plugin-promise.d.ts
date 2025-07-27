declare module 'eslint-plugin-promise' {
  import { type Linter } from 'eslint';

  export const configs: {
    'flat/recommended': Linter.Config;
  };
}
