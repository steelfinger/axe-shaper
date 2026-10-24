import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const release = JSON.parse(readFileSync(resolve(root, 'config/sharing-release.json'), 'utf8'));
const environment = process.argv[2];
if (!['staging', 'production'].includes(environment)) throw new Error('Choose staging or production explicitly');
const production = environment === 'production';
if (production) {
  if (!release.productionSharingEnabled) throw new Error('Production sharing is not enabled in the reviewed release manifest. Complete the launch gates first.');
  const local = process.argv.includes('--local-verified');
  const tags = execFileSync('git', ['tag', '--points-at', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim().split('\n');
  const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
  if (local ? dirty || !tags.includes(release.releaseTag)
    : process.env.GITHUB_REF_TYPE !== 'tag' || process.env.GITHUB_REF_NAME !== release.releaseTag) {
    throw new Error('Production deployment requires the matching tag and a clean checkout. Use npm run deploy for the checked laptop fallback.');
  }
}
const project = production ? 'axe-shaper-web' : 'axe-shaper-staging';
const config = production ? 'firebase.sharing-production.json' : 'firebase.staging.json';
execFileSync('node', ['scripts/check-sharing-release.ts'], { cwd: root, stdio: 'inherit' });
if (!existsSync(resolve(root, 'functions/lib/index.js'))) throw new Error('Build Functions first');
if (!process.argv.includes('--backend-only') && !existsSync(resolve(root, 'dist/viewer3d/index.html'))) throw new Error('Run build:site first');
if (production) writeFileSync(resolve(root, `functions/.env.${project}`), [
  `SHARING_RELEASE_TAG=${release.releaseTag}`, `SHARING_MAX_ACCEPTED_SCHEMA=${release.maxAcceptedProjectSchema}`,
  'SHARING_HOSTING_SITES=axeshaper.com,www.axeshaper.com,axe-shaper-web.web.app,axe-shaper-web.firebaseapp.com',
  'SHARING_PUBLIC_ORIGIN=https://axeshaper.com', '',
].join('\n'));
const deploy = (only: string) => execFileSync('firebase', ['deploy', '--non-interactive', '--project', project, '--config', config, '--only', only],
  { cwd: root, stdio: 'inherit' });
// Firebase finalizes pinned Hosting after Functions succeed. One invocation also
// avoids Hosting's pinTag auto-deploy rebuilding the same Function a second time.
// Runtime controls are never initialized or overwritten by a deploy.
deploy(process.argv.includes('--backend-only') ? 'firestore,functions:sharing' : 'firestore,functions:sharing,hosting');
