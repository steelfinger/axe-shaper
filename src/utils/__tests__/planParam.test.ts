import { describe, expect, it } from 'vitest';
import { planParamFromSearch } from '../planParam';

describe('planParamFromSearch', () => {
  it('accepts a same-origin absolute path', () => {
    expect(planParamFromSearch('?plan=/marketing/foo.axe.svg')).toBe('/marketing/foo.axe.svg');
  });

  it.each([
    ['absolute https URL', '?plan=https://evil.example/x.axe.svg'],
    ['protocol-relative URL', '?plan=//evil.example/x.axe.svg'],
    ['relative path', '?plan=marketing/foo.axe.svg'],
    ['javascript: scheme', '?plan=javascript:alert(1)'],
    ['empty value', '?plan='],
    ['absent parameter', '?other=1'],
    ['no query at all', ''],
  ])('rejects %s', (_label, search) => {
    expect(planParamFromSearch(search)).toBeNull();
  });
});
