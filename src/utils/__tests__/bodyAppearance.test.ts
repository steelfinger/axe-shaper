import { describe, expect, it } from 'vitest';
import { createProject } from '../projectFactory';
import { resolveBodyAppearance } from '../instrumentAppearance';
import { projectForViewerLink } from '../viewer3dLink';
import { exportProjectToSVG, extractProjectFromSVG } from '../svgExporter';
import { requiredSchemaVersion } from '../../constants/schema';
import { PROJECT_REVISION_READERS, UPLOAD_POLICY_REVISION, validateProjectUpload } from '../../sharing/projectAdmission';

describe('body appearance persistence and compatibility', () => {
  it('resolves legacy finishes without modifying or restamping the project', () => {
    const project = createProject();
    const before = JSON.stringify(project);
    expect(resolveBodyAppearance(project).finish).toBe('sunburst_3');
    expect(JSON.stringify(project)).toBe(before);
    expect(requiredSchemaVersion(project)).toBe(7);
    project.settings.finishStyle = 'flame_maple';
    expect(resolveBodyAppearance(project)).toMatchObject({ material: 'flame_maple', finish: 'natural' });
  });
  it('preserves wood, all colors and opacity in saves and viewer links', () => {
    const project = createProject();
    project.instrumentAppearance!.body = { material: 'swamp_ash', finish: 'sunburst_2', color: '#ffdd44',
      middleColor: '#bb2222', edgeColor: '#112233', opacity: 0.35 };
    project.schemaVersion = requiredSchemaVersion(project);
    expect(project.schemaVersion).toBe(9);
    const reopened = extractProjectFromSVG(exportProjectToSVG(project));
    expect(reopened?.instrumentAppearance?.body).toEqual(project.instrumentAppearance!.body);
    expect(projectForViewerLink(project).instrumentAppearance?.body).toEqual(project.instrumentAppearance!.body);
    expect(validateProjectUpload(reopened, { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 9 })).toMatchObject({ ok: true });
    expect(PROJECT_REVISION_READERS['project-upload-v2'](project, 8).ok).toBe(false);
    reopened!.instrumentAppearance!.body!.opacity = 1.1;
    expect(validateProjectUpload(reopened, { revision: UPLOAD_POLICY_REVISION, maxAcceptedProjectSchema: 9 })).toMatchObject({ ok: false, path: 'project.instrumentAppearance.body.opacity' });
  });
});
