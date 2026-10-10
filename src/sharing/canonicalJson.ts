/** Shared browser/server JSON boundary. No project migration or catalogue imports. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type CanonicalJsonErrorCode = 'invalid-json' | 'duplicate-property' | 'invalid-unicode' | 'resource-limit' | 'crypto-unavailable';

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
export const SHARING_JSON_LIMITS = {
  maxBytes: 1024 * 1024, // Raw request UTF-8 bytes.
  maxCanonicalBytes: 6 * 1024 * 1024, // Headroom for ECMAScript number expansion.
  maxDepth: 64,
  maxNodes: 100_000,
} as const;

function fail(code: CanonicalJsonErrorCode): never { throw new CanonicalJsonError(code); }

/** Matches TextEncoder byte length without allocating a second copy of the body. */
function boundedUtf8Length(value: string, limit: number): number {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit < 0x80) bytes++;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff &&
      value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) {
      bytes += 4;
      i++;
    } else bytes += 3; // TextEncoder replaces unpaired surrogates with U+FFFD.
    if (bytes > limit) fail('resource-limit');
  }
  return bytes;
}

/** Measure escaped JSON text before JSON.stringify allocates it. */
function boundedJsonStringLength(value: string, limit: number): number {
  let bytes = 2; // Quotes.
  if (bytes > limit) fail('resource-limit');
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit < 0x20) bytes += (unit === 8 || unit === 9 || unit === 10 || unit === 12 || unit === 13) ? 2 : 6;
    else if (unit === 0x22 || unit === 0x5c) bytes += 2;
    else if (unit < 0x80) bytes++;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('invalid-unicode');
      bytes += 4;
    } else {
      if (unit >= 0xdc00 && unit <= 0xdfff) fail('invalid-unicode');
      bytes += 3;
    }
    if (bytes > limit) fail('resource-limit');
  }
  return bytes;
}

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
  if (source.length > SHARING_JSON_LIMITS.maxBytes) fail('resource-limit');
  boundedUtf8Length(source, SHARING_JSON_LIMITS.maxBytes);
  let offset = 0;
  let nodes = 0;
  const whitespace = () => {
    while (offset < source.length) {
      const code = source.charCodeAt(offset);
      if (code !== 0x20 && code !== 9 && code !== 10 && code !== 13) break;
      offset++;
    }
  };
  const numberToken = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
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
    numberToken.lastIndex = offset;
    const number = numberToken.exec(source);
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
  const chunks: string[] = [];
  let bytes = 0;
  let nodes = 0;
  const append = (chunk: string) => {
    bytes += boundedUtf8Length(chunk, SHARING_JSON_LIMITS.maxCanonicalBytes - bytes);
    chunks.push(chunk);
  };
  const appendString = (value: string) => {
    bytes += boundedJsonStringLength(value, SHARING_JSON_LIMITS.maxCanonicalBytes - bytes);
    chunks.push(JSON.stringify(value));
  };
  const encode = (value: unknown, depth: number): void => {
    if (depth > SHARING_JSON_LIMITS.maxDepth || ++nodes > SHARING_JSON_LIMITS.maxNodes) fail('resource-limit');
    if (value === null) { append('null'); return; }
    if (typeof value === 'string') { appendString(value); return; }
    if (typeof value === 'boolean') { append(JSON.stringify(value)); return; }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) fail('invalid-json');
      append(JSON.stringify(value));
      return;
    }
    if (typeof value !== 'object' || ancestors.has(value)) fail('invalid-json');
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (!array && prototype !== Object.prototype && prototype !== null) fail('invalid-json');
    const keys = Reflect.ownKeys(value);
    if (keys.length > SHARING_JSON_LIMITS.maxNodes + (array ? 1 : 0)) fail('resource-limit');
    if (keys.some(key => typeof key !== 'string')) fail('invalid-json');
    const descriptors = Object.getOwnPropertyDescriptors(value);
    for (const key of keys as string[]) {
      if (array && key === 'length') continue;
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || !('value' in descriptor)) fail('invalid-json');
      checkUnicode(key);
    }
    ancestors.add(value);
    if (array) {
      if (value.length > SHARING_JSON_LIMITS.maxNodes) fail('resource-limit');
      if (keys.length !== value.length + 1) fail('invalid-json');
      append('[');
      for (let i = 0; i < value.length; i++) {
        if (!Object.hasOwn(descriptors, String(i))) fail('invalid-json');
        if (i) append(',');
        encode(descriptors[String(i)].value, depth + 1);
      }
      append(']');
    } else {
      // Emit names directly; JSON.stringify(object) reorders integer-like keys.
      append('{');
      for (const [i, key] of (keys as string[]).sort().entries()) {
        if (i) append(',');
        appendString(key);
        append(':');
        encode(descriptors[key].value, depth + 1);
      }
      append('}');
    }
    ancestors.delete(value);
  };
  encode(input, 0);
  return chunks.join('');
}

/** Hash only the complete project value, never the envelope or creator secrets. */
export async function projectDigest(project: unknown): Promise<`sha256:${string}`> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) fail('crypto-unavailable');
  const bytes = new TextEncoder().encode(canonicalizeJson(project));
  const digest = await subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}
