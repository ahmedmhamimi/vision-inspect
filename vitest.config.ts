/**
 * vitest.config.ts
 * Test runner configuration.
 *
 * - Uses the same "@/*" path alias as the Next.js app so test imports match source imports.
 * - Runs in a Node environment (no DOM needed — these are domain/API-layer tests, not
 *   component-rendering tests).
 */
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
});
