import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const release = JSON.parse(readFileSync(resolve(import.meta.dirname, '../config/sharing-release.json'), 'utf8'));
const response = await fetch(release.nativeEvidence.source, { signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error('Cannot verify the live iPad release');
const app = (await response.json()).results?.find((entry: { trackId: number }) => entry.trackId === 6799075557);
const parts = (value: string) => value.split('.').map(BigInt);
if (!app || !/^\d+\.\d+\.\d+$/.test(app.version)) throw new Error('Apple returned no verifiable app version');
const actual = parts(app.version), required = parts(release.confirmedIpadVersion);
for (let i = 0; i < 3; i++) {
  if (actual[i] > required[i]) break;
  if (actual[i] < required[i]) throw new Error('The live iPad app is older than the reviewed schema evidence');
}
console.log(`Apple confirms Axe Shaper ${app.version}; reviewed schema ${release.confirmedIpadEditableSchema} evidence is for ${release.confirmedIpadVersion}.`);
