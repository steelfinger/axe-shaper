import { defineConfig } from 'rolldown';

// Bundles the shared src/sharing contract code into the Function. The Firebase
// SDKs stay external: Cloud Build installs them from functions/package.json.
export default defineConfig({
  input: 'functions/src/index.ts',
  platform: 'node',
  external: /^firebase-(admin|functions)(\/|$)/,
  output: { file: 'functions/lib/index.js', format: 'esm', codeSplitting: false },
});
