/** Checked fallback when GitHub Actions is unavailable. Uses the same tagged policy and composed build. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const release = JSON.parse(readFileSync(resolve(root, 'config/sharing-release.json'), 'utf8'));
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) throw new Error('Commit or stash changes before a production deploy.');
if (!git('tag', '--points-at', 'HEAD').split('\n').includes(release.releaseTag)) throw new Error(`Check out reviewed tag ${release.releaseTag} before deploying production.`);
const env = { ...process.env, VITE_SCHEMA_9_AUTHORING: release.schema9Authoring ? '1' : '0',
  VITE_SHARING: release.productionSharingEnabled ? '1' : '0' };
// A static build carries no App Check settings. Blank values here outrank the
// staging ones a local .env.local would otherwise compile into production.
if (!release.productionSharingEnabled) {
  for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_PROJECT_ID', 'VITE_RECAPTCHA_SITE_KEY']) env[key] = '';
}
if (release.productionSharingEnabled && (env.VITE_FIREBASE_PROJECT_ID !== 'axe-shaper-web' ||
  !env.VITE_FIREBASE_API_KEY || !env.VITE_FIREBASE_APP_ID || !env.VITE_RECAPTCHA_SITE_KEY)) {
  throw new Error('Supply all four production App Check build variables explicitly before building.');
}
const run = (command: string, args: string[]) => execFileSync(command, args, { cwd: root, env, stdio: 'inherit' });
run('npm', ['run', 'lint']);
run('npm', ['test']);
run('node', ['scripts/verify-native-release.ts']);
run('npm', ['run', 'build:site']);
run('npm', ['run', 'e2e:run']);
for (const script of ['dxf:check', 'corpus:check', 'schema:check', 'bass:check', 'fixtures:check']) run('npm', ['run', script]);
if (release.productionSharingEnabled) {
  run('npm', ['run', 'functions:build']);
  run('npm', ['run', 'functions:test']);
  run('node', ['scripts/deploy-sharing.ts', 'production', '--local-verified']);
  run('npm', ['run', 'sharing:smoke', '--', 'https://axeshaper.com']);
} else {
  run('firebase', ['deploy', '--non-interactive', '--project', 'axe-shaper-web', '--config', 'firebase.json', '--only', 'hosting']);
  // Titles alone pass against the previous release too. The hashed entry
  // scripts are unique to this build, so the live pages must name them.
  const entry = (html: string) => html.match(/\/(?:viewer3d\/)?assets\/[^"']+\.js/)?.[0];
  const expected = ['index.html', 'viewer3d/index.html'].map(page => entry(readFileSync(resolve(root, 'dist', page), 'utf8')));
  if (expected.some(asset => !asset)) throw new Error('Cannot find the built entry scripts to compare against');
  for (let attempt = 1; ; attempt++) {
    const live = await Promise.all(['/', '/viewer3d/'].map(async path =>
      (await fetch(`https://axeshaper.com${path}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })).text()));
    if (live.every((html, index) => html.includes(expected[index]!))) break;
    if (attempt === 6) throw new Error(`The live site does not serve this build (${expected.join(', ')})`);
    await new Promise(done => setTimeout(done, 10_000));
  }
  console.log(`Live site serves this build: ${expected.join(', ')}.`);
}
