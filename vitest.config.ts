import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'eslint/',
        'dist/',
        'script/',
        'test/',
        '**/*.d.ts',
        '*.ts',
        '*.mjs',
      ],
    },
  },
  plugins: [tsconfigPaths()],
});
