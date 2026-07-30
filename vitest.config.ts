import { defineConfig } from 'vitest/config';

// A dedicated Vitest config so the runner does NOT load vite.config.ts (which
// wires in the Cloudflare Worker + Flue plugins — incompatible with the node
// test environment). Unit tests here target pure logic: config validation,
// indicator classification, record filtering, report formatting, and PII
// redaction. They run in plain node with no Worker runtime.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
