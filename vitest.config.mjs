import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Simulates a browser (document, localStorage) inside Node.
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    // A fixed time zone keeps date tests repeatable on every machine and in CI.
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      include: ['js/**/*.js'],
      // FEAT #11: third-party code we did not write is not counted.
      exclude: ['js/vendor/**'],
      reporter: ['text', 'html', 'json-summary'],
    },
  },
});
