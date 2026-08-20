#!/usr/bin/env node
// Composes the standalone 3D viewer into this site at /viewer3d.
//
// The viewer is developed in steelfinger/axe-shape-3D-viewer and publishes a
// static bundle, built for the /viewer3d/ base path, as a release asset. A
// Firebase Hosting deploy replaces the whole site, so the viewer cannot deploy
// itself into a path here; this repository pins a viewer release and owns the
// single deploy. Never add a build or runtime import across the two repos.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const repo = 'steelfinger/axe-shape-3D-viewer';
const asset = 'viewer3d-dist.tgz';

const pinPath = join(root, 'viewer3d.version');
if (!existsSync(pinPath)) {
  throw new Error('viewer3d.version is missing; pin a viewer release tag.');
}
const version = readFileSync(pinPath, 'utf8').trim();
if (!version) {
  throw new Error('viewer3d.version is empty; pin a viewer release tag.');
}

if (!existsSync(join(root, 'dist'))) {
  throw new Error('dist/ is missing; run npm run build before composing the viewer.');
}

const target = join(root, 'dist', 'viewer3d');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

const staging = mkdtempSync(join(tmpdir(), 'viewer3d-'));
try {
  execFileSync(
    'gh',
    ['release', 'download', version, '--repo', repo, '--pattern', asset, '--dir', staging],
    { stdio: 'inherit' },
  );
  execFileSync('tar', ['-xzf', join(staging, asset), '-C', target], { stdio: 'inherit' });
} finally {
  rmSync(staging, { recursive: true, force: true });
}

// A missing entry point would deploy a silently empty /viewer3d.
if (!existsSync(join(target, 'index.html'))) {
  throw new Error(`${asset} contained no index.html; refusing to publish an empty /viewer3d.`);
}

console.log(`Composed viewer3d ${version} into dist/viewer3d.`);
