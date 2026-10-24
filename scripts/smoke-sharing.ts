import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const release = JSON.parse(readFileSync(resolve(import.meta.dirname, '../config/sharing-release.json'), 'utf8'));
const origin = process.argv[2];
if (!['https://axe-shaper-staging.web.app', 'https://axeshaper.com', 'https://axe-shaper-web.web.app'].includes(origin)) throw new Error('Use an explicit Axe Shaper environment');
async function json(path: string, status = 200) {
  const response = await fetch(origin + path, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
  if (response.status !== status || !response.headers.get('content-type')?.includes('application/json')) throw new Error(`${path}: expected JSON ${status}, received ${response.status} ${response.headers.get('content-type')}`);
  return response.json();
}
const status = await json('/api/sharing-status');
for (const [key, value] of Object.entries({ releaseTag: release.releaseTag, uploadPolicyRevision: release.uploadPolicyRevision,
  maxAcceptedProjectSchema: release.maxAcceptedProjectSchema })) {
  if (status[key] !== value) throw new Error(`Deployed ${key} differs: ${status[key]} != ${value}`);
}
for (const tag of ['v1.2.0', 'v1.3.2', release.releaseTag]) {
  const actual = await json(`/sharing/releases/${tag}.json`);
  const expected = JSON.parse(readFileSync(resolve(import.meta.dirname, `../public/sharing/releases/${tag}.json`), 'utf8'));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Compatibility manifest differs: ${tag}`);
}
const invalid = await json('/api/shares/not-a-valid-id', 400);
if (invalid.error?.code !== 'invalid-id') throw new Error('Unexpected invalid-ID response');
const page = await fetch(origin + '/share/not-a-valid-id');
if (page.status !== 404 || !(await page.text()).includes('design')) throw new Error('Invalid landing route is not a real error page');
const viewer = await fetch(origin + '/viewer3d/');
if (!(await viewer.text()).includes('Axe Shaper 3D Viewer')) throw new Error('Viewer bundle missing');
console.log(`Sharing smoke passed at ${origin}: ${release.releaseTag}, schema ${status.maxAcceptedProjectSchema}, creation ${status.creationAvailable ? 'enabled' : 'paused'}.`);
