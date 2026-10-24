import { describe, expect, it } from 'vitest';
import { SHARING_RELEASE, SUPPORT_MANIFESTS, validateRecordedSharingRelease } from '../deployment';

describe('recorded sharing release', () => {
  it('keeps the v1.2.0 web and pinned v0.1.20 viewer at their actual schema 7 ceiling', () => {
    expect(SUPPORT_MANIFESTS['v1.2.0']).toMatchObject({ webReadSchema: 7, viewerReadSchema: 7 });
    expect(SUPPORT_MANIFESTS['v1.2.0'].minimumEditableIpadVersionBySchema[8]).toBeNull();
  });
  it('compares hotfix compatibility against an independent recorded baseline', () => {
    expect(validateRecordedSharingRelease(SHARING_RELEASE)).toEqual([]);
    expect(validateRecordedSharingRelease({ ...SHARING_RELEASE, maxAcceptedProjectSchema: 10,
      confirmedIpadEditableSchema: 10, serverReadSchema: 10, webReadSchema: 10, viewerReadSchema: 10 }))
      .toContain('hotfix-changes-compatibility');
    expect(validateRecordedSharingRelease({ ...SHARING_RELEASE, schema9Authoring: false }))
      .toContain('hotfix-changes-compatibility');
  });
});
