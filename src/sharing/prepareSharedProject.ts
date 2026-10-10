import type { GuitarProject, StoredProject } from '../types/guitar';
import { withEmbeddedPresets } from '../utils/presets';
import { CanonicalJsonError, parseSharingJson, projectDigest } from './canonicalJson';
import { validateProjectUpload } from './projectAdmission';
import type { ProjectAdmissionPolicy, ProjectAdmissionResult } from './projectAdmission';

type AdmissionFailure = Extract<ProjectAdmissionResult, { ok: false }>;
export type PreparedSharedProject =
  | { ok: true; project: GuitarProject; digest: `sha256:${string}` }
  | AdmissionFailure
  | { ok: false; code: 'crypto-unavailable'; path: 'project' };

function freezeJson(value: unknown): void {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeJson);
    Object.freeze(value);
  }
}

/**
 * Client-only save adapter. Prepare the same JSON value embedded by SVG export,
 * including JSON's omission of optional undefined fields, then validate it using
 * the server's strict policy. Freeze before hashing so edits during async work
 * cannot change the snapshot. No changes are made to the working project.
 * This is preflight groundwork; the consent flow and full request are pending.
 */
export async function prepareSharedProject(
  workingProject: StoredProject,
  policy: ProjectAdmissionPolicy,
): Promise<PreparedSharedProject> {
  let project: unknown;
  try {
    project = parseSharingJson(JSON.stringify(withEmbeddedPresets(workingProject)));
  } catch (error) {
    return { ok: false, code: error instanceof CanonicalJsonError && error.code === 'resource-limit'
      ? 'resource-limit' : 'invalid-project', path: 'project' };
  }
  const admission = validateProjectUpload(project, policy);
  if (!admission.ok) return admission;
  freezeJson(admission.project);
  try {
    return { ok: true, project: admission.project, digest: await projectDigest(admission.project) };
  } catch (error) {
    if (error instanceof CanonicalJsonError) {
      return { ok: false, code: error.code === 'crypto-unavailable' ? 'crypto-unavailable'
        : error.code === 'resource-limit' ? 'resource-limit' : 'invalid-project', path: 'project' };
    }
    throw error;
  }
}
