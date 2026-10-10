import workflow from '../../../.github/workflows/firebase-hosting-release.yml?raw';
import { describe, expect, it } from 'vitest';
import { parseSharingReleaseTag, validateSharingReleasePolicy } from '../releasePolicy';
import type { SharingReleasePolicy } from '../releasePolicy';

// Test data, not evidence of a live App Store release or a deployment manifest.
const base: SharingReleasePolicy = {
  releaseTag: 'v1.2.0', baseCoordinatedTag: 'v1.2.0', confirmedIpadVersion: '1.2.0',
  confirmedIpadEditableSchema: 7, maxAcceptedProjectSchema: 7,
  serverReadSchema: 8, webReadSchema: 8, viewerReadSchema: 8, outputJackAuthoring: false,
};

describe('sharing release compatibility policy', () => {
  it('accepts coordinated/hotfix tags and checks the workflow contains the broad tag pattern', () => {
    expect(workflow).toContain("- 'v*'");
    expect(parseSharingReleaseTag('v1.2.0')).toEqual({ baseCoordinatedTag: 'v1.2.0', hotfix: false });
    expect(parseSharingReleaseTag('v1.2.0-web.12')).toEqual({ baseCoordinatedTag: 'v1.2.0', hotfix: true });
    expect(validateSharingReleasePolicy(base)).toEqual([]);
    expect(validateSharingReleasePolicy({ ...base, releaseTag: 'v1.2.0-web.1' }, base)).toEqual([]);
  });
  it('rejects ambiguous or unsupported tag/version spellings', () => {
    for (const tag of ['v01.2.0', 'v1.2', 'v1.2.0-web.0', 'v1.2.0-web.01', 'v1.2.0-webX1', 'v1.2.0-rc.1', 'v1.2.0\n']) {
      expect(parseSharingReleaseTag(tag)).toBeNull();
    }
    expect(validateSharingReleasePolicy({ ...base, baseCoordinatedTag: 'v1.1.0' })).toContain('invalid-release-tag');
    expect(validateSharingReleasePolicy({ ...base, confirmedIpadVersion: '1.2.0-web.1' })).toContain('invalid-ipad-version');
    expect(validateSharingReleasePolicy({ ...base, confirmedIpadVersion: '1.2.0\n' })).toContain('invalid-ipad-version');
  });
  it('ties coordinated release tags to the confirmed iPad marketing version', () => {
    expect(validateSharingReleasePolicy({ ...base, releaseTag: 'v1.3.0', baseCoordinatedTag: 'v1.3.0' }))
      .toContain('coordinated-version-mismatch');
    expect(validateSharingReleasePolicy({ ...base, releaseTag: 'v1.3.0', baseCoordinatedTag: 'v1.3.0', confirmedIpadVersion: '1.3.0' }))
      .toEqual([]);
  });
  it('rejects a hotfix whose base and confirmed iPad version disagree', () => {
    const invalidBase = { ...base, confirmedIpadVersion: '1.1.0' };
    const hotfix = { ...invalidBase, releaseTag: 'v1.2.0-web.1' };
    expect(validateSharingReleasePolicy(invalidBase)).toContain('coordinated-version-mismatch');
    expect(validateSharingReleasePolicy(hotfix, invalidBase)).toContain('coordinated-version-mismatch');
  });
  it('enforces each reader and the independently confirmed native ceiling', () => {
    expect(validateSharingReleasePolicy({ ...base, maxAcceptedProjectSchema: 8 })).toContain('schema-exceeds-ipad');
    for (const key of ['serverReadSchema', 'webReadSchema', 'viewerReadSchema'] as const) {
      expect(validateSharingReleasePolicy({ ...base, [key]: 6 })).toContain('schema-exceeds-reader');
    }
    expect(validateSharingReleasePolicy({ ...base, maxAcceptedProjectSchema: 7.5 })).toContain('invalid-schema');
    expect(validateSharingReleasePolicy({ ...base, outputJackAuthoring: true })).toContain('authoring-exceeds-admission');
  });
  it('requires base evidence and preserves hotfix compatibility gates', () => {
    const hotfix = { ...base, releaseTag: 'v1.2.0-web.2' };
    expect(validateSharingReleasePolicy(hotfix)).toContain('hotfix-changes-compatibility');
    for (const changed of [{ maxAcceptedProjectSchema: 6 }, { outputJackAuthoring: true }, { confirmedIpadVersion: '1.3.0' }, { confirmedIpadEditableSchema: 8 }]) {
      expect(validateSharingReleasePolicy({ ...hotfix, ...changed }, base)).toContain('hotfix-changes-compatibility');
    }
    expect(validateSharingReleasePolicy(hotfix, { ...base, releaseTag: 'v1.1.0' })).toContain('hotfix-changes-compatibility');
  });
});
