#!/usr/bin/env node
/** Export contract data only; never replace a revision's existing definition. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const server = await createServer({ root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false } });
try {
  const policy = await server.ssrLoadModule('/src/sharing/projectAdmission.ts');
  const path = resolve(root, 'tests/fixtures/sharing', `${policy.UPLOAD_POLICY_REVISION}-definition.json`);
  const contents = `${JSON.stringify(policy.PROJECT_UPLOAD_POLICY_DEFINITION, null, 2)}\n`;
  if (existsSync(path)) {
    if (readFileSync(path, 'utf8') !== contents) throw new Error('Sharing policy drift: add a revision and retain its historical definition/reader.');
  } else {
    if (process.argv.includes('--check')) throw new Error('Sharing policy definition is missing.');
    writeFileSync(path, contents);
  }
  console.log(`Sharing definition verified: ${policy.UPLOAD_POLICY_REVISION}.`);
} finally {
  await server.close();
}
