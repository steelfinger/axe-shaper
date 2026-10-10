/** Shared browser/server JSON boundary. No project migration or catalogue imports. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type CanonicalJsonErrorCode = 'invalid-json' | 'duplicate-property' | 'invalid-unicode' | 'resource-limit';

export class CanonicalJsonError extends Error {
  readonly code: CanonicalJsonErrorCode;
  constructor(code: CanonicalJsonErrorCode) {
    // Never include request content: it can contain project metadata or creator keys.
    super(code);
    this.name = 'CanonicalJsonError';
    this.code = code;
  }
}

// Transport safety limits, not the still-to-be-defined project admission policy.
export const SHARING_JSON_LIMITS = { maxBytes: 1024 * 1024, maxDepth: 64, maxNodes: 100_000 } as const;

function fail(code: CanonicalJsonErrorCode): never { throw new CanonicalJsonError(code); }

function checkUnicode(value: string): void {
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('invalid-unicode');
    } else if (unit >= 0xdc00 && unit <= 0xdfff) fail('invalid-unicode');
  }
}

/**
 * Parse the raw body before JSON.parse can discard duplicate names. Each scope
 * compares decoded names, so "x" and "\u0078" are also duplicates.
 * Limits bound work before any admission, quota or persistence operations.
 */
export function parseSharingJson(source: string): JsonValue {
  if (source.length > SHARING_JSON_LIMITS.maxBytes ||
      new TextEncoder().encode(source).byteLength > SHARING_JSON_LIMITS.maxBytes) fail('resource-limit');
  let offset = 0;
  let nodes = 0;
  const whitespace = () => { while (/[\x20\t\r\n]/.test(source[offset] ?? '') && offset < source.length) offset++; };
  const string = (): string => {
    const start = offset++;
    while (offset < source.length) {
      const char = source[offset++];
      if (char === '\\') { offset++; continue; }
      if (char === '"') {
        let value: string;
        try { value = JSON.parse(source.slice(start, offset)); } catch { return fail('invalid-json'); }
        checkUnicode(value);
        return value;
      }
    }
    return fail('invalid-json');
  };
  const value = (depth: number): JsonValue => {
    if (depth > SHARING_JSON_LIMITS.maxDepth || ++nodes > SHARING_JSON_LIMITS.maxNodes) fail('resource-limit');
    whitespace();
    const char = source[offset];
    if (char === '"') return string();
    if (char === '{') {
      offset++;
      const result: { [key: string]: JsonValue } = {};
      const names = new Set<string>();
      whitespace();
      if (source[offset] === '}') { offset++; return result; }
      while (true) {
        whitespace();
        if (source[offset] !== '"') fail('invalid-json');
        const name = string();
        if (names.has(name)) fail('duplicate-property');
        names.add(name);
        whitespace();
        if (source[offset++] !== ':') fail('invalid-json');
        // Define rather than assign: __proto__ is ordinary JSON data.
        Object.defineProperty(result, name, { value: value(depth + 1), enumerable: true, writable: true, configurable: true });
        whitespace();
        const next = source[offset++];
        if (next === '}') return result;
        if (next !== ',') fail('invalid-json');
      }
    }
    if (char === '[') {
      offset++;
      const result: JsonValue[] = [];
      whitespace();
      if (source[offset] === ']') { offset++; return result; }
      while (true) {
        result.push(value(depth + 1));
        whitespace();
        const next = source[offset++];
        if (next === ']') return result;
        if (next !== ',') fail('invalid-json');
      }
    }
    for (const [token, literal] of [['true', true], ['false', false], ['null', null]] as const) {
      if (source.startsWith(token, offset)) { offset += token.length; return literal; }
    }
    const number = source.slice(offset).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (!number) fail('invalid-json');
    offset += number[0].length;
    const parsed = Number(number[0]);
    if (!Number.isFinite(parsed)) fail('invalid-json');
    return parsed;
  };
  const parsed = value(0);
  whitespace();
  if (offset !== source.length) fail('invalid-json');
  return parsed;
}

/** RFC 8785: UTF-16 name ordering and ECMAScript primitive serialization. */
export function canonicalizeJson(input: unknown): string {
  const ancestors = new Set<object>();
  let nodes = 0;
  const encode = (value: unknown, depth: number): string => {
    if (depth > SHARING_JSON_LIMITS.maxDepth || ++nodes > SHARING_JSON_LIMITS.maxNodes) fail('resource-limit');
    if (value === null) return 'null';
    if (typeof value === 'string') { checkUnicode(value); return JSON.stringify(value); }
    if (typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('invalid-json');
      return JSON.stringify(value);
    }
    if (typeof value !== 'object' || ancestors.has(value)) fail('invalid-json');
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (!array && prototype !== Object.prototype && prototype !== null) fail('invalid-json');
    const keys = Reflect.ownKeys(value);
    if (keys.some(key => typeof key !== 'string')) fail('invalid-json');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of keys as string[]) {
      if (array && key === 'length') continue;
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !('value' in descriptor)) fail('invalid-json');
      checkUnicode(key);
    }
    ancestors.add(value);
    let result: string;
    if (array) {
      if (value.length > SHARING_JSON_LIMITS.maxNodes) fail('resource-limit');
      if (keys.length !== value.length + 1) fail('invalid-json');
      const items: string[] = [];
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(descriptors, String(i))) fail('invalid-json');
        items.push(encode(descriptors[String(i)].value, depth + 1));
      }
      result = `[${items.join(',')}]`;
    } else {
      // Emit names directly; JSON.stringify(object) reorders integer-like keys.
      result = `{${(keys as string[]).sort().map(key => `${JSON.stringify(key)}:${encode(descriptors[key].value, depth + 1)}`).join(',')}}`;
    }
    ancestors.delete(value);
    return result;
  };
  const result = encode(input, 0);
  if (new TextEncoder().encode(result).byteLength > SHARING_JSON_LIMITS.maxBytes) fail('resource-limit');
  return result;
}

/** Hash only the complete project value, never the envelope or creator secrets. */
export async function projectDigest(project: unknown): Promise<`sha256:${string}`> {
  const bytes = new TextEncoder().encode(canonicalizeJson(project));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
