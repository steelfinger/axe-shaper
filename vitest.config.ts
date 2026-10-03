import { defineConfig } from 'vitest/config'

// Pure logic only for now (src/utils, src/constants): no DOM environment, so a
// test that reaches for `window` fails loudly instead of quietly depending on
// jsdom. The contract checks under scripts/ stay separate - they own the
// golden corpus and the iOS fixtures.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
