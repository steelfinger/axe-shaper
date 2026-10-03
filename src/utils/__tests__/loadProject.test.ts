import { describe, expect, it } from 'vitest';
import { PROJECT_SCHEMA_VERSION } from '../../constants/schema';
import { createProject } from '../projectFactory';
import { loadProject, offeredBridgePresets, offeredNeckPresets, offeredPickupTypes } from '../presets';
import { bridgePresetInstrument, neckPresetInstrument, pickupTypeInstrument } from '../instrument';

// What a JSON round-trip hands loadProject: plain data, as read from a file.
const stored = (project: unknown) => JSON.parse(JSON.stringify(project));

describe('loadProject', () => {
  it('opens a project it just created', () => {
    const result = loadProject(stored(createProject()));
    expect(result.ok).toBe(true);
  });

  it('refuses a payload from a newer schema version', () => {
    const future = { ...stored(createProject()), schemaVersion: PROJECT_SCHEMA_VERSION + 1 };
    const result = loadProject(future);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsupported-version');
  });

  it('refuses a known instrument with a string count it cannot draw', () => {
    const bass5 = { ...stored(createProject()), instrumentType: 'bass', stringCount: 5 };
    const result = loadProject(bass5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unsupported-instrument');
  });

  it('reads a file with no instrument axis as Guitar/6', () => {
    const legacy = stored(createProject());
    delete legacy.instrumentType;
    delete legacy.stringCount;
    const result = loadProject(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.project.instrumentType).toBe('guitar');
      expect(result.project.stringCount).toBe(6);
    }
  });

  it.each([null, undefined, {}, { contour: {} }])('reports %j as unreadable', (input) => {
    const result = loadProject(input as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('unreadable');
  });
});

describe('instrument isolation of the catalogue', () => {
  it.each(['guitar', 'bass'] as const)('%s pickers offer only %s hardware', (instrument) => {
    expect(offeredNeckPresets(instrument).length).toBeGreaterThan(0);
    for (const neck of offeredNeckPresets(instrument)) expect(neckPresetInstrument(neck.id)).toBe(instrument);
    for (const bridge of offeredBridgePresets(instrument)) expect(bridgePresetInstrument(bridge.id)).toBe(instrument);
    for (const type of offeredPickupTypes(instrument)) expect(pickupTypeInstrument(type)).toBe(instrument);
  });
});
