import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const server = await createServer({ root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false } });
try {
  const { assertSharingDeployment, SHARING_RELEASE: release, SUPPORT_MANIFESTS: manifests } = await server.ssrLoadModule('/src/sharing/deployment.ts');
  assertSharingDeployment();
  const { PINNED_VIEWER_READ_SCHEMA } = await server.ssrLoadModule('/src/utils/viewer3dLink.ts');
  if (release.viewerReadSchema !== PINNED_VIEWER_READ_SCHEMA) throw new Error('Viewer reader capability disagrees with release manifest');
  const pin = readFileSync(resolve(root, 'viewer3d.version'), 'utf8').trim();
  if (pin !== release.viewerRelease) throw new Error('Viewer pin disagrees with sharing release manifest');
  const tag = process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : undefined;
  if (tag && tag !== release.releaseTag) throw new Error('Tag disagrees with reviewed release manifest');
  const params = readFileSync(resolve(root, 'functions/.env.axe-shaper-staging'), 'utf8');
  if (!params.includes(`SHARING_RELEASE_TAG=${release.releaseTag}\n`) ||
    !params.includes(`SHARING_MAX_ACCEPTED_SCHEMA=${release.maxAcceptedProjectSchema}\n`)) throw new Error('Staging parameters disagree with manifest');
  for (const config of ['firebase.staging.json', 'firebase.sharing-production.json']) {
    const rewrites = JSON.parse(readFileSync(resolve(root, config), 'utf8')).hosting.rewrites;
    const pinned = new Set<string>();
    for (const rewrite of rewrites) {
      if (!rewrite.function?.pinTag) continue;
      const key = `${rewrite.function.region}/${rewrite.function.functionId}`;
      if (pinned.has(key)) throw new Error(`${config}: duplicate pinTag rules race in Firebase CLI; combine their paths in one rewrite`);
      pinned.add(key);
    }
  }
  for (const [tag, manifest] of Object.entries(manifests)) {
    const file = resolve(root, `public/sharing/releases/${tag}.json`);
    const contents = JSON.stringify(manifest, null, 2) + '\n';
    if (process.argv.includes('--write') && !existsSync(file)) {
      mkdirSync(resolve(root, 'public/sharing/releases'), { recursive: true });
      writeFileSync(file, contents);
    }
    if (!existsSync(file) || readFileSync(file, 'utf8') !== contents) throw new Error(`Missing or changed immutable manifest: ${tag}`);
  }
  console.log(`Sharing release verified: ${release.releaseTag}, schema ${release.maxAcceptedProjectSchema}, ${release.uploadPolicyRevision}, viewer ${pin}.`);
} finally { await server.close(); }
