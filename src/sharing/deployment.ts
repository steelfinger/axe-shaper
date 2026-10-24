import release from '../../config/sharing-release.json';
import supportRecords from '../../config/sharing-support.json';
import basePolicies from '../../config/sharing-base-policies.json';
import type { SharingReleasePolicy } from './releasePolicy';
import { PROJECT_SCHEMA_VERSION } from '../constants/schema';
import { UPLOAD_POLICY_REVISION } from './projectAdmission';
import { validateSharingReleasePolicy } from './releasePolicy';
import { readSharingClientSupportManifest } from './sharingContract';
import type { SharingClientSupportManifest } from './sharingContract';

export const SHARING_RELEASE = Object.freeze(release);
export function validateRecordedSharingRelease(candidate: SharingReleasePolicy) {
  const baseline = (basePolicies as Record<string, SharingReleasePolicy>)[candidate.baseCoordinatedTag];
  return validateSharingReleasePolicy(candidate, baseline);
}

export function assertSharingDeployment(tag = release.releaseTag, ceiling = release.maxAcceptedProjectSchema): void {
  const errors = validateRecordedSharingRelease(release);
  if (errors.length || tag !== release.releaseTag || ceiling !== release.maxAcceptedProjectSchema ||
    release.serverReadSchema !== PROJECT_SCHEMA_VERSION || release.webReadSchema !== PROJECT_SCHEMA_VERSION ||
    release.uploadPolicyRevision !== UPLOAD_POLICY_REVISION) {
    throw new Error(`Sharing release/configuration mismatch: ${errors.join(', ') || 'tag, reader or policy'}`);
  }
}

/** Retain every published entry. These compatibility records never contain administrative data. */
export const SUPPORT_MANIFESTS: Readonly<Record<string, SharingClientSupportManifest>> = Object.freeze(
  Object.fromEntries(Object.entries(supportRecords).map(([tag, record]) =>
    [tag, readSharingClientSupportManifest(JSON.stringify(record), tag)])),
);

export function minimumIpadVersion(schema: number): string | null {
  return SUPPORT_MANIFESTS[release.releaseTag].minimumEditableIpadVersionBySchema[schema] ?? null;
}
