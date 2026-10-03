import { describe, expect, it } from 'vitest';
import { projectNameFromTemplate } from '../projectNaming';

describe('projectNameFromTemplate', () => {
  it('prefixes a bare blueprint name', () => {
    expect(projectNameFromTemplate('S-Style Standard')).toBe('Custom S-Style Standard');
  });

  it('is idempotent for names that already start with Custom', () => {
    expect(projectNameFromTemplate('Custom P-Style Bass Blueprint')).toBe('Custom P-Style Bass Blueprint');
    expect(projectNameFromTemplate('custom')).toBe('custom');
  });

  it('does not treat a word merely starting with "custom" as the prefix', () => {
    expect(projectNameFromTemplate('Customary')).toBe('Custom Customary');
  });

  it('falls back to Custom for an empty name', () => {
    expect(projectNameFromTemplate('   ')).toBe('Custom');
  });
});
