import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteUserTemplate,
  getUserTemplate,
  loadUserTemplates,
  saveUserTemplate,
  userTemplateInstrument,
  type UserTemplate,
} from '../userTemplates';
import { createProject } from '../projectFactory';
import { requiredSchemaVersion } from '../../constants/schema';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem = (key: string) => this.data.get(key) ?? null;
  setItem = (key: string, value: string) => void this.data.set(key, value);
  removeItem = (key: string) => void this.data.delete(key);
}

const KEY = 'axe-shaper:user-templates';
const template = (id: string, extra: Partial<UserTemplate> = {}): UserTemplate => ({
  id,
  name: id,
  neckPresetId: 'fender_strat_21',
  bridgePresetId: 'tremolo_strat',
  defaultAnchors: [],
  defaultPickups: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

let storage: MemoryStorage;
beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

describe('user templates storage', () => {
  it('is empty before anything is saved', () => {
    expect(loadUserTemplates()).toEqual([]);
  });

  it('saves, reads back and deletes', () => {
    saveUserTemplate(template('a'));
    saveUserTemplate(template('b'));
    expect(loadUserTemplates().map((t) => t.id)).toEqual(['a', 'b']);
    expect(getUserTemplate('b')?.id).toBe('b');
    expect(deleteUserTemplate('a').map((t) => t.id)).toEqual(['b']);
    expect(getUserTemplate('a')).toBeUndefined();
  });

  it('replaces a template saved again under the same id', () => {
    saveUserTemplate(template('a', { name: 'first' }));
    const all = saveUserTemplate(template('a', { name: 'second' }));
    expect(all).toHaveLength(1);
    expect(getUserTemplate('a')?.name).toBe('second');
  });

  it.each([['corrupt JSON', '{not json'], ['a non-array', '{"a":1}']])('reads %s as empty', (_l, raw) => {
    storage.setItem(KEY, raw);
    expect(loadUserTemplates()).toEqual([]);
  });

  it('reads as empty when storage itself throws (private window, blocked site data)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
    });
    expect(loadUserTemplates()).toEqual([]);
  });
});

describe('userTemplateInstrument', () => {
  it('reads an untagged record as Guitar/6, since nothing else was drawable then', () => {
    expect(userTemplateInstrument({})).toEqual({ instrumentType: 'guitar', stringCount: 6 });
  });

  it('keeps a tagged record', () => {
    expect(userTemplateInstrument({ instrumentType: 'bass', stringCount: 4 })).toEqual({
      instrumentType: 'bass',
      stringCount: 4,
    });
  });

  it('does not trust an unrecognised stored instrument or count', () => {
    expect(userTemplateInstrument({ instrumentType: 'ukulele' as never, stringCount: NaN })).toEqual({
      instrumentType: 'guitar',
      stringCount: 6,
    });
  });

  it('defaults the count to the instrument\'s own when only the count is missing', () => {
    expect(userTemplateInstrument({ instrumentType: 'bass' })).toEqual({ instrumentType: 'bass', stringCount: 4 });
  });
});

describe('user templates and output jacks', () => {
  const jack = { id: 'j', position: { x: 10, y: 20 }, mountingStyle: 'strat_plate', angleDegrees: 15 } as const;

  it('carries a saved jack into a new design, which then needs schema 8', () => {
    saveUserTemplate(template('with-jack', { defaultJacks: [jack] }));
    const project = createProject({ templateId: 'with-jack' });
    expect(project.jacks).toEqual([jack]);
    expect(requiredSchemaVersion(project)).toBe(8);
  });

  it('leaves a jack-free design without the key', () => {
    saveUserTemplate(template('plain'));
    expect('jacks' in createProject({ templateId: 'plain' })).toBe(false);
    expect('jacks' in createProject()).toBe(false);
  });
});
