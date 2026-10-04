import { describe, expect, it } from 'vitest';
import {
  BASE_SCHEMA_VERSION,
  PROJECT_SCHEMA_VERSION,
  isSupportedSchemaVersion,
  requiredSchemaVersion,
} from '../../constants/schema';

// requiredSchemaVersion is what a save stamps. Stamping too high strands the
// file on the older iPad build; too low misdescribes it. Both are silent.
const stamp = (fields: Partial<Parameters<typeof requiredSchemaVersion>[0]>) =>
  requiredSchemaVersion(fields as Parameters<typeof requiredSchemaVersion>[0]);
const any = (value: unknown) => value as never;

describe('requiredSchemaVersion', () => {
  it('stamps the floor for a plain project', () => {
    expect(stamp({})).toBe(BASE_SCHEMA_VERSION);
    expect(stamp({ potentiometers: [], switches: [] })).toBe(BASE_SCHEMA_VERSION);
  });

  it('stamps 4 once a potentiometer or switch is placed', () => {
    expect(stamp({ potentiometers: any([{}]) })).toBe(4);
    expect(stamp({ switches: any([{}]) })).toBe(4);
  });

  it('stamps 5 for a bodyTop, 6 for an appearance, 7 for neck joint objects', () => {
    expect(stamp({ bodyTop: any({}) })).toBe(5);
    expect(stamp({ instrumentAppearance: any({}) })).toBe(6);
    expect(stamp({ neckJointGeometry: any({}) })).toBe(7);
    expect(stamp({ neckPlacement: any({}) })).toBe(7);
  });

  it('stamps 8 only for the blocks and sharkfins inlays, ahead of the v7 pair', () => {
    const appearance = (fretboardInlay: string) => any({ fretboardInlay });
    expect(stamp({ instrumentAppearance: appearance('blocks') })).toBe(8);
    expect(stamp({ instrumentAppearance: appearance('sharkfins'), neckJointGeometry: any({}) })).toBe(8);
    expect(stamp({ instrumentAppearance: appearance('blocks'), neckJointGeometry: any({}), neckPlacement: any({}) })).toBe(8);
    expect(stamp({ instrumentAppearance: appearance('dots'), neckJointGeometry: any({}) })).toBe(7);
    expect(stamp({ instrumentAppearance: appearance('trapezoids'), neckJointGeometry: any({}) })).toBe(7);
    expect(stamp({ instrumentAppearance: appearance('trapezoids') })).toBe(6);
  });

  it('takes the highest version any field needs', () => {
    expect(stamp({ potentiometers: any([{}]), bodyTop: any({}) })).toBe(5);
    expect(stamp({ bodyTop: any({}), instrumentAppearance: any({}) })).toBe(6);
  });

  it('keeps a claim from a version it does not understand', () => {
    expect(stamp({ schemaVersion: PROJECT_SCHEMA_VERSION + 1 })).toBe(PROJECT_SCHEMA_VERSION + 1);
  });

  it('ignores a nonsense stamp and describes the payload instead', () => {
    expect(stamp({ schemaVersion: 0 })).toBe(BASE_SCHEMA_VERSION);
    expect(stamp({ schemaVersion: 2.5, bodyTop: any({}) })).toBe(5);
  });

  it('never stamps above what this build understands for a payload it can read', () => {
    const everything = { potentiometers: any([{}]), bodyTop: any({}), instrumentAppearance: any({}), neckJointGeometry: any({}) };
    expect(stamp(everything)).toBeLessThanOrEqual(PROJECT_SCHEMA_VERSION);
  });
});

describe('isSupportedSchemaVersion', () => {
  it('accepts versions from 1 up to this build and nothing else', () => {
    expect(isSupportedSchemaVersion(1)).toBe(true);
    expect(isSupportedSchemaVersion(PROJECT_SCHEMA_VERSION)).toBe(true);
    expect(isSupportedSchemaVersion(PROJECT_SCHEMA_VERSION + 1)).toBe(false);
    expect(isSupportedSchemaVersion(0)).toBe(false);
    expect(isSupportedSchemaVersion('3')).toBe(false);
    expect(isSupportedSchemaVersion(undefined)).toBe(false);
  });
});
