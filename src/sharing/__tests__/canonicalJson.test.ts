import { describe, expect, it } from 'vitest';
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
    expect(errorCode(() => canonicalizeJson('x'.repeat(SHARING_JSON_LIMITS.maxBytes)))).toBe('resource-limit');
  });
  it('hashes all metadata without mutating the project', async () => {
    const project = Object.freeze({ name: 'Design', metadata: Object.freeze({ author: 'A' }), geometry: [0.1, -0] });
    const before = JSON.stringify(project);
    expect(await projectDigest(project)).not.toBe(await projectDigest({ ...project, metadata: { author: 'B' } }));
    expect(JSON.stringify(project)).toBe(before);
    expect(await projectDigest({ a: 1, b: 2 })).toBe(await projectDigest(parseSharingJson('{"b":2.0,"a":1e0}')));
  });
});
