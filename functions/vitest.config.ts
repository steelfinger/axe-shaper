import { defineConfig } from 'vitest/config';

// Firestore adapter tests. They need the Firestore emulator, so they run only
// through `npm run functions:test` (emulators:exec), never in `npm test`.
export default defineConfig({
  test: { environment: 'node', include: ['functions/src/**/*.test.ts'], testTimeout: 20_000 },
});
