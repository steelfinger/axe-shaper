import { afterEach, describe, expect, it, vi } from 'vitest';
import vectors from '../../../tests/fixtures/sharing/jcs-digest-vectors.json';
import { canonicalizeJson, CanonicalJsonError, parseSharingJson, projectDigest, SHARING_JSON_LIMITS } from '../canonicalJson';

function errorCode(action: () => unknown): string {
  try { action(); } catch (error) {
    if (error instanceof CanonicalJsonError) return error.code;
    throw error;
  }
  throw new Error('Expected JSON rejection');
}

describe('sharing canonical JSON contract', () => {
  afterEach(() => vi.unstubAllGlobals());
  for (const vector of vectors.accepted) {
    it(vector.id, async () => {
      const project = parseSharingJson(vector.inputJson);
      expect(canonicalizeJson(project)).toBe(vector.canonicalJson);
      expect(await projectDigest(project)).toBe(vector.expectedDigest);
    });
  }
  for (const vector of vectors.rejected) {
    it(vector.id, () => expect(errorCode(() => parseSharingJson(vector.inputJson))).toBe(vector.expectedError));
  }
  it('detects decoded duplicate names recursively without leaking request contents', () => {
    for (const input of ['{"x":1,"\\u0078":2}', '[{"secret":"a","secret":"b"}]', '{"x":{"a":1,"a":2}}']) {
      expect(errorCode(() => parseSharingJson(input))).toBe('duplicate-property');
    }
    expect(parseSharingJson('{"a":{"x":1},"b":{"x":2}}')).toEqual({ a: { x: 1 }, b: { x: 2 } });
  });
  it('treats prototype names as data', () => {
    const parsed = parseSharingJson('{"__proto__":{"polluted":true},"constructor":0}');
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(canonicalizeJson(parsed)).toBe('{"__proto__":{"polluted":true},"constructor":0}');
  });
  it('rejects malformed syntax and binary64 overflow', () => {
    for (const input of ['', '{"x":1,}', '[1,]', '01', '1.', '1e', '1e400', 'true false', '\u00a0null', '"a\n"', '"\\q"']) {
      expect(errorCode(() => parseSharingJson(input))).toBe('invalid-json');
    }
  });
  it('checks Unicode in names and values, preserving paired surrogates', () => {
    for (const input of ['{"\\ud800":1}', '"\\udc00"', '"\\ud800x"']) {
      expect(errorCode(() => parseSharingJson(input))).toBe('invalid-unicode');
    }
    expect(parseSharingJson('"\\ud83d\\ude00"')).toBe('😀');
    expect(errorCode(() => canonicalizeJson({ '\ud800': 1 }))).toBe('invalid-unicode');
  });
  it('rejects non-JSON objects instead of coercing them or calling their getters', () => {
    const cycle: unknown[] = []; cycle.push(cycle);
    for (const input of [undefined, NaN, Infinity, 1n, new Date(), { x: undefined }, new Array(2), cycle, { toJSON: () => 1 }, { [Symbol('x')]: 1 }]) {
      expect(errorCode(() => canonicalizeJson(input))).toBe('invalid-json');
    }
    let called = false;
    expect(errorCode(() => canonicalizeJson({ get x() { called = true; return 1; } }))).toBe('invalid-json');
    expect(called).toBe(false);
  });
  it('bounds raw bytes, depth and node counts', () => {
    expect(errorCode(() => parseSharingJson(' '.repeat(SHARING_JSON_LIMITS.maxBytes + 1)))).toBe('resource-limit');
    expect(errorCode(() => parseSharingJson(JSON.stringify('é'.repeat(SHARING_JSON_LIMITS.maxBytes / 2))))).toBe('resource-limit');
    expect(errorCode(() => parseSharingJson('['.repeat(65) + '0' + ']'.repeat(65)))).toBe('resource-limit');
    expect(errorCode(() => parseSharingJson('[' + '0,'.repeat(100_000) + '0]'))).toBe('resource-limit');
    expect(errorCode(() => canonicalizeJson('x'.repeat(SHARING_JSON_LIMITS.maxCanonicalBytes)))).toBe('resource-limit');
  });
  it('allows canonical number expansion beyond the raw request limit', async () => {
    const source = '[' + Array(60_000).fill('1e20').join(',') + ']';
    const parsed = parseSharingJson(source);
    const canonical = canonicalizeJson(parsed);
    expect(new TextEncoder().encode(source).byteLength).toBeLessThan(SHARING_JSON_LIMITS.maxBytes);
    expect(new TextEncoder().encode(canonical).byteLength).toBeGreaterThan(SHARING_JSON_LIMITS.maxBytes);
    expect(await projectDigest(parsed)).toBe(await projectDigest(Array(60_000).fill(1e20)));
  });
  it('counts raw UTF-8 bytes correctly for all character widths', () => {
    for (const char of ['a', 'é', '漢', '😀']) {
      const width = new TextEncoder().encode(char).byteLength;
      const length = Math.floor((SHARING_JSON_LIMITS.maxBytes - 2) / width);
      const source = JSON.stringify(char.repeat(length));
      expect(parseSharingJson(source)).toBe(char.repeat(length));
      expect(errorCode(() => parseSharingJson(JSON.stringify(char.repeat(length + 1))))).toBe('resource-limit');
    }
  });
  it('counts escaped strings before allocating output, including names and astral characters', () => {
    const max = SHARING_JSON_LIMITS.maxCanonicalBytes;
    expect(canonicalizeJson('x'.repeat(max - 2)).length).toBe(max);
    for (const [char, width] of [['\u0000', 6], ['\n', 2], ['"', 2], ['\\', 2], ['é', 2], ['漢', 3], ['😀', 4]] as const) {
      const length = Math.floor((max - 2) / width);
      const value = char.repeat(length);
      expect(canonicalizeJson(value)).toBe(JSON.stringify(value));
      expect(errorCode(() => canonicalizeJson(char.repeat(length + 1)))).toBe('resource-limit');
    }
    expect(errorCode(() => canonicalizeJson({ ['\u0000'.repeat(max / 6)]: 0 }))).toBe('resource-limit');
  });
  it('stops oversized serialization before visiting later subtrees', () => {
    let visited = false;
    const later = new Proxy({}, { getPrototypeOf() { visited = true; return Object.prototype; } });
    const oversized = [Array(8).fill('x'.repeat(1024 * 1024)), later];
    expect(errorCode(() => canonicalizeJson(oversized))).toBe('resource-limit');
    expect(visited).toBe(false);
  });
  it('returns a typed error when hashing is unavailable in the browser context', async () => {
    for (const crypto of [undefined, {}]) {
      vi.stubGlobal('crypto', crypto);
      await expect(projectDigest({ name: 'Design' })).rejects.toMatchObject({
        name: 'CanonicalJsonError', code: 'crypto-unavailable', message: 'crypto-unavailable',
      });
    }
  });
  it('hashes all metadata without mutating the project', async () => {
    const project = Object.freeze({ name: 'Design', metadata: Object.freeze({ author: 'A' }), geometry: [0.1, -0] });
    const before = JSON.stringify(project);
    expect(await projectDigest(project)).not.toBe(await projectDigest({ ...project, metadata: { author: 'B' } }));
    expect(JSON.stringify(project)).toBe(before);
    expect(await projectDigest({ a: 1, b: 2 })).toBe(await projectDigest(parseSharingJson('{"b":2.0,"a":1e0}')));
  });
});
