/**
 * Runs every gate this project has, across all three repositories, locally.
 *
 * It exists because CI is not a reliable answer here. Actions minutes are
 * billed on the two private repositories, and when that billing lapses their
 * jobs die in a few seconds with "the job was not started" - which renders in
 * the UI exactly like a genuine test failure. Neither repository has branch
 * protection either (it is a paid feature on private repositories), so nothing
 * is gated on those checks: a red tick there blocks no merge and proves no
 * fault. A stale cross-platform mesh corpus once rode that ambiguity for two
 * commits, because the failing check looked like the billing noise beside it.
 *
 * So the local run is the evidence, and this makes it one command instead of
 * three remembered ones. It mirrors each repository's own gate rather than
 * inventing a new one:
 *
 *   web     - the `verify` workflow's steps, in its order
 *   viewer  - `npm run check` (lint, tests, contract, preview capability, build)
 *   iOS     - the full XCTest suite on an available iPad simulator
 *
 * Usage:
 *   node scripts/check-all.ts                 every repository
 *   node scripts/check-all.ts --only=web,ios  a subset
 *   node scripts/check-all.ts --skip=ios      everything but iOS (it is the slow one)
 *   node scripts/check-all.ts --verbose       stream output instead of capturing it
 *   node scripts/check-all.ts --bail          stop at the first failure
 *
 * The sibling checkouts are found next to this one, or named by AXE_IOS_DIR
 * and AXE_VIEWER_DIR. A repository that is not checked out is reported as
 * skipped, not as a failure - a web-only contributor still gets a clean run.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SIBLINGS = resolve(ROOT, '..');

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const verbose = flag('verbose');
const bail = flag('bail');
const only = value('only')?.split(',').map(s => s.trim()).filter(Boolean);
const skip = value('skip')?.split(',').map(s => s.trim()).filter(Boolean) ?? [];

/** The viewer's directory name is missing an 'r'; accept both spellings. */
function findRepo(envName: string, ...names: string[]): string | undefined {
  const fromEnv = process.env[envName];
  if (fromEnv) return existsSync(fromEnv) ? resolve(fromEnv) : undefined;
  return names.map(name => join(SIBLINGS, name)).find(existsSync);
}

const IOS = findRepo('AXE_IOS_DIR', 'axe-shaper-ios');
const VIEWER = findRepo('AXE_VIEWER_DIR', 'axe-shape-3D-viewer', 'axe-shaper-3D-viewer');

interface Step { label: string; command: string; args: string[]; cwd: string }
interface Result { repo: string; label: string; ok: boolean; skipped?: string; seconds: number }

/**
 * A simulator UDID, not a name and OS version. The runtime *identifier*
 * truncates the patch release - `iOS-26-4` is the home of OS 26.4.1 - so a
 * destination built from it matches nothing and xcodebuild answers by listing
 * every device it does know, which reads like a test failure. The UDID is
 * unambiguous.
 *
 * An iPad, because the app's targeted device family excludes iPhone: pointing
 * xcodebuild at one fails with "doesn't match any of AxeShaper.app's targeted
 * device families" rather than quietly running nothing.
 */
function iPadSimulator(): { destination: string; label: string } | undefined {
  const listed = spawnSync('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { encoding: 'utf8' });
  if (listed.status !== 0) return undefined;
  try {
    const devices = JSON.parse(listed.stdout).devices as Record<string, Array<{ name: string; udid: string; isAvailable?: boolean }>>;
    const runtimeOrder = (key: string) => (key.split('iOS-')[1] ?? '')
      .split('-').map(Number).reduce((value, part) => value * 1000 + (Number.isFinite(part) ? part : 0), 0);
    const newestFirst = Object.keys(devices)
      .filter(key => key.includes('iOS'))
      .sort((a, b) => runtimeOrder(b) - runtimeOrder(a));
    for (const runtime of newestFirst) {
      const iPad = devices[runtime].find(device => device.name.startsWith('iPad') && device.isAvailable !== false);
      if (iPad) {
        const version = (runtime.split('iOS-')[1] ?? '').replace(/-/g, '.');
        return { destination: `platform=iOS Simulator,id=${iPad.udid}`, label: `${iPad.name}, iOS ${version}` };
      }
    }
  } catch { /* fall through to "no simulator" */ }
  return undefined;
}

function webSteps(): Step[] {
  // The `verify` workflow's steps, in its order. `build` is tsc + vite, and
  // carries bridge:check with it.
  return ['lint', 'build', 'dxf:check', 'corpus:check', 'schema:check', 'bass:check', 'fixtures:check']
    .map(script => ({ label: script, command: 'npm', args: ['run', '--silent', script], cwd: ROOT }));
}

function run(step: Step): { ok: boolean; seconds: number; output: string } {
  const started = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: step.cwd,
    encoding: 'utf8',
    stdio: verbose ? 'inherit' : 'pipe',
    env: process.env,
  });
  const seconds = (Date.now() - started) / 1000;
  const output = verbose ? '' : `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return { ok: result.status === 0, seconds, output };
}

const results: Result[] = [];
let failed = false;

function section(repo: string, steps: Step[] | { skipped: string }) {
  if (only && !only.includes(repo)) return;
  if (skip.includes(repo)) {
    results.push({ repo, label: '-', ok: true, skipped: 'asked to skip', seconds: 0 });
    return;
  }
  if ('skipped' in steps) {
    results.push({ repo, label: '-', ok: true, skipped: steps.skipped, seconds: 0 });
    console.log(`\n== ${repo}: skipped (${steps.skipped})`);
    return;
  }
  console.log(`\n== ${repo}`);
  for (const step of steps) {
    if (failed && bail) return;
    process.stdout.write(`   ${step.label} ... `);
    const { ok, seconds, output } = run(step);
    console.log(ok ? `ok (${seconds.toFixed(1)}s)` : `FAILED (${seconds.toFixed(1)}s)`);
    if (!ok && !verbose) {
      // The tail is where a test runner puts its summary; the head is usually
      // the toolchain announcing itself.
      const lines = output.trimEnd().split('\n');
      console.log(lines.slice(-40).map(line => `      ${line}`).join('\n'));
    }
    results.push({ repo, label: step.label, ok, seconds });
    if (!ok) failed = true;
  }
}

section('web', webSteps());

section('viewer', VIEWER
  ? [{ label: 'npm run check', command: 'npm', args: ['run', '--silent', 'check'], cwd: VIEWER }]
  : { skipped: 'no checkout beside this one; set AXE_VIEWER_DIR' });

if (!IOS) {
  section('ios', { skipped: 'no checkout beside this one; set AXE_IOS_DIR' });
} else {
  const simulator = iPadSimulator();
  section('ios', simulator
    ? [{
      label: `xcodebuild test (${simulator.label})`,
      command: 'xcodebuild',
      args: ['test', '-scheme', 'AxeShaper', '-destination', simulator.destination],
      cwd: IOS,
    }]
    : { skipped: 'no available iPad simulator; check xcode-select and installed runtimes' });
}

const ran = results.filter(result => !result.skipped);
const total = ran.reduce((sum, result) => sum + result.seconds, 0);
console.log('\n---');
for (const result of results) {
  if (result.skipped) console.log(`SKIP ${result.repo}: ${result.skipped}`);
}
console.log(
  failed
    ? `FAILED: ${ran.filter(result => !result.ok).map(result => `${result.repo}/${result.label}`).join(', ')}`
    : ran.length
      ? `All ${ran.length} check${ran.length === 1 ? '' : 's'} passed in ${total.toFixed(0)}s.`
      : 'Nothing ran.',
);
if (!failed && results.some(result => result.skipped)) {
  console.log('Some repositories were skipped - this is not a full cross-platform result.');
}
process.exit(failed ? 1 : 0);
