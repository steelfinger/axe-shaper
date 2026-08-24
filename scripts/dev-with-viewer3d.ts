#!/usr/bin/env node
// Runs the editor and the sibling 3D viewer as one local site. The viewer is
// built for /viewer3d/ and copied to Vite's public directory after every build.
import { spawn } from 'node:child_process';
import { cpSync, existsSync, rmSync, watch } from 'node:fs';
import { join, resolve } from 'node:path';

const appRoot = resolve(import.meta.dirname, '..');
const viewerRoot = process.env.VIEWER3D_DIR
  ? resolve(process.env.VIEWER3D_DIR)
  : ['../axe-shape-3D-viewer', '../axe-shaper-3D-viewer']
      .map((path) => resolve(appRoot, path))
      .find((path) => existsSync(join(path, 'package.json')));

if (!viewerRoot) {
  throw new Error(
    '3D viewer checkout not found. Set VIEWER3D_DIR=/absolute/path/to/axe-shape-3D-viewer.',
  );
}

const viewerDist = join(viewerRoot, 'dist');
const publicViewer = join(appRoot, 'public', 'viewer3d');
let syncTimer: ReturnType<typeof setTimeout> | undefined;
let syncedOnce = false;

function syncViewer() {
  // Only copy complete viewer builds. `dist/` is absent until Vite finishes
  // its first build, and its entry point detects a valid bundle.
  if (!existsSync(join(viewerDist, 'index.html'))) return;
  rmSync(publicViewer, { recursive: true, force: true });
  cpSync(viewerDist, publicViewer, { recursive: true });
  if (!syncedOnce) {
    syncedOnce = true;
    console.log(`\nViewer available at http://localhost:5173/viewer3d/\n`);
  } else {
    console.log('Updated local /viewer3d/ bundle. Reload the viewer page.');
  }
}

function queueSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(syncViewer, 150);
}

function run(command: string, args: string[], cwd: string) {
  // A separate process group lets Ctrl+C stop npm and its Vite child too.
  return spawn(command, args, { cwd, stdio: 'inherit', detached: true });
}

const viewer = run('npm', ['run', 'build', '--', '--watch'], viewerRoot);
// Keep the documented port stable: if another server owns 5173, fail instead
// of silently splitting the editor and viewer across unexpected URLs.
const app = run('npm', ['run', 'dev', '--', '--strictPort'], appRoot);

// Watch the directory rather than individual assets: Vite replaces hashed
// files on each build. Polling once also catches the initial build when dist
// did not exist when this command started.
let distWatcher: ReturnType<typeof watch> | undefined;
const discoverDist = setInterval(() => {
  if (!existsSync(viewerDist) || distWatcher) return;
  distWatcher = watch(viewerDist, { recursive: true }, queueSync);
  queueSync();
}, 100);

let stopping = false;

function stopProcessTree(child: ReturnType<typeof spawn>) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function stop(exitCode: number) {
  if (stopping) return;
  stopping = true;
  clearInterval(discoverDist);
  if (syncTimer) clearTimeout(syncTimer);
  distWatcher?.close();
  stopProcessTree(viewer);
  stopProcessTree(app);
  process.exit(exitCode);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => stop(0));
}
viewer.on('exit', (code) => stop(code ?? 1));
app.on('exit', (code) => stop(code ?? 1));
