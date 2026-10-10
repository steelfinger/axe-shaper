/** Deployment recency comes from the release ledger, never SemVer sorting. */
const VERSION = '(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)';
const TAG = new RegExp(`^(v${VERSION})(?:-web\\.([1-9]\\d*))?$`);

export function parseSharingReleaseTag(tag: string): { baseCoordinatedTag: string; hotfix: boolean } | null {
  const match = TAG.exec(tag);
  return match && match[0] === tag ? { baseCoordinatedTag: match[1], hotfix: !!match[2] } : null;
}

/** Compatibility portion of the eventual complete deployment manifest. */
export interface SharingReleasePolicy {
  releaseTag: string;
  baseCoordinatedTag: string;
  confirmedIpadVersion: string;
  confirmedIpadEditableSchema: number;
  maxAcceptedProjectSchema: number;
  serverReadSchema: number;
  webReadSchema: number;
  viewerReadSchema: number;
  outputJackAuthoring: boolean;
}

export type ReleasePolicyError = 'invalid-release-tag' | 'invalid-ipad-version' | 'invalid-schema' |
  'schema-exceeds-reader' | 'schema-exceeds-ipad' | 'authoring-exceeds-admission' | 'hotfix-changes-compatibility';

/** Pure policy check. Supplied iPad evidence must still be verified before deployment. */
export function validateSharingReleasePolicy(
  policy: SharingReleasePolicy,
  basePolicy?: SharingReleasePolicy,
): ReleasePolicyError[] {
  const errors = new Set<ReleasePolicyError>();
  const tag = parseSharingReleaseTag(policy.releaseTag);
  if (!tag || tag.baseCoordinatedTag !== policy.baseCoordinatedTag) errors.add('invalid-release-tag');
  if (new RegExp(`^${VERSION}$`).exec(policy.confirmedIpadVersion)?.[0] !== policy.confirmedIpadVersion) errors.add('invalid-ipad-version');
  const ceilings = [policy.confirmedIpadEditableSchema, policy.maxAcceptedProjectSchema,
    policy.serverReadSchema, policy.webReadSchema, policy.viewerReadSchema];
  if (ceilings.some(value => !Number.isSafeInteger(value) || value < 3)) errors.add('invalid-schema');
  if ([policy.serverReadSchema, policy.webReadSchema, policy.viewerReadSchema]
    .some(value => value < policy.maxAcceptedProjectSchema)) errors.add('schema-exceeds-reader');
  if (policy.maxAcceptedProjectSchema > policy.confirmedIpadEditableSchema) errors.add('schema-exceeds-ipad');
  if (policy.outputJackAuthoring && policy.maxAcceptedProjectSchema < 8) errors.add('authoring-exceeds-admission');
  if (tag?.hotfix && (!basePolicy || basePolicy.releaseTag !== tag.baseCoordinatedTag ||
    basePolicy.baseCoordinatedTag !== tag.baseCoordinatedTag ||
    policy.maxAcceptedProjectSchema !== basePolicy.maxAcceptedProjectSchema ||
    policy.outputJackAuthoring !== basePolicy.outputJackAuthoring ||
    policy.confirmedIpadVersion !== basePolicy.confirmedIpadVersion ||
    policy.confirmedIpadEditableSchema !== basePolicy.confirmedIpadEditableSchema)) {
    errors.add('hotfix-changes-compatibility');
  }
  return [...errors];
}
