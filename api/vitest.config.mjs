// Backend test configuration (Vitest - same describe/test/expect API as Jest).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true, // describe/test/expect available without imports, like Jest.
    include: ['tests/**/*.test.js'],
    setupFiles: ['./tests/setupEnv.js'],
    fileParallelism: false, // All files share one test database, so run them one at a time.
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
