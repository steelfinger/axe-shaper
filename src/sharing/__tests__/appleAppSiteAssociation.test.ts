import associationSource from '../../../public/.well-known/apple-app-site-association?raw';
import hostingDefault from '../../../firebase.json?raw';
import hostingProduction from '../../../firebase.sharing-production.json?raw';
import hostingStaging from '../../../firebase.staging.json?raw';
import { describe, expect, it } from 'vitest';

// The iPad app (axe-shaper-ios, M33) opens /share/<id> and /app/share/<id>
// itself; every other route stays on the web. Its own `ShareLink` re-checks
// the same routes, but this file decides what iOS hands it at all.
const file = '.well-known/apple-app-site-association';
const association = JSON.parse(associationSource);
const configs: [string, string][] = [['firebase.json', hostingDefault], ['firebase.staging.json', hostingStaging],
  ['firebase.sharing-production.json', hostingProduction]];

// Firebase lists files with glob 10: `**/` is any leading directories, `*`
// never crosses a `/`. So `**/.*` matches a dotted last segment only, and
// the file inside `.well-known/` is still uploaded.
const ignored = (path: string, pattern: string) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  .replace(/\*\*\/|\*\*|\*/g, glob => ({ '**/': '(?:.*/)?', '**': '.*' })[glob] ?? '[^/]*')}$`).test(path);

// AASA component syntax: `?` is one character, `*` any run of characters.
const opens = (path: string) => association.applinks.details.some((detail: { components: { '/': string; exclude?: boolean }[] }) => {
  const match = detail.components.find(component =>
    new RegExp(`^${component['/'].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\?/g, '.').replace(/\*/g, '.*')}$`).test(path));
  return match !== undefined && !match.exclude;
});

describe('apple-app-site-association', () => {
  it('names only the iPad app', () => {
    expect(association.applinks.details.map((detail: { appIDs: string[] }) => detail.appIDs))
      .toEqual([['LNX3277TP2.com.axeshaper.AxeShaper']]);
  });

  it('hands the app the two design routes and nothing else', () => {
    const id = 'A1b2C3d4E5f6G7h8I9j0';
    for (const path of [`/share/${id}`, `/share/${id}/`, `/app/share/${id}`, `/app/share/${id}/`]) {
      expect(opens(path), path).toBe(true);
    }
    for (const path of [`/share/${id}/3d`, `/share/${id}/3d/`, `/download/share/${id}`, `/manage/share/${id}`,
      '/share/', '/app', '/', `/api/shares/${id}`, `/viewer3d/?share=${id}`]) {
      expect(opens(path), path).toBe(false);
    }
  });

  it('reads ignore patterns the way Firebase does', () => {
    expect(ignored('a/.DS_Store', '**/.*')).toBe(true);
    expect(ignored('.DS_Store', '**/.*')).toBe(true);
    expect(ignored('node_modules/x/y.js', '**/node_modules/**')).toBe(true);
  });

  it.each(configs)('is deployed and served as JSON by %s', (_, source) => {
    const hosting = JSON.parse(source).hosting;
    for (const pattern of hosting.ignore) expect(ignored(file, pattern), pattern).toBe(false);
    const headers = hosting.headers.find((rule: { source: string }) => rule.source === `/${file}`)?.headers;
    expect(headers).toContainEqual({ key: 'Content-Type', value: 'application/json' });
  });
});
