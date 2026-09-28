import type { GuitarProject } from '../types/guitar';

/**
 * A fabrication-facing disclosure for a v7 joint whose fit is not verified.
 * Legacy projects deliberately return null: changing their SVG/DXF bytes is
 * outside the v7 migration contract.
 */
export function neckJointFabricationDisclosure(project: GuitarProject): string | null {
  const geometry = project.neckJointGeometry;
  if (!geometry) return null;

  if (geometry.mode === 'custom') {
    return 'Custom neck joint — verify against the physical neck before cutting.';
  }

  switch (geometry.profileSnapshot?.evidenceLevel) {
    case 'verified':
      return null;
    case 'documented':
      return 'Documented neck joint — verify against the physical neck before cutting.';
    case 'measured':
      return 'Measured neck joint — verify against the physical neck before cutting.';
    default:
      return 'Unverified neck joint — verify against the physical neck before cutting.';
  }
}
