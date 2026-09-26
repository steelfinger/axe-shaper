import type { GuitarProject } from '../types/guitar';

// Fragment contract shared with the standalone 3D viewer
// (steelfinger/axe-shape-3D-viewer, deployed at /viewer3d). Never sent over
// the network: everything after "#" stays in the browser. #v=2&d=<payload>
// is a self-contained link — the 3D projection of the project, deflate-raw
// compressed, then base64url encoded. The viewer still accepts legacy #d=
// full-project links. Keep this in sync with that repo's src/core/shareLink.ts.

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * The 3D renderer needs geometry and its own visual inputs, not editor
 * history, project metadata, guide images, grid settings, back routes, or
 * redundant preset ids. Keep this as a normal-shaped project rather than a
 * second save format: the viewer can validate it with its ordinary project
 * reader and old viewers can still open the link.
 */
export type ViewerLinkProject = Pick<
  GuitarProject,
  | 'schemaVersion'
  | 'instrumentType'
  | 'stringCount'
  | 'activeTemplateId'
  | 'contour'
  | 'edgeProfile'
  | 'binding'
  | 'bodyThicknessMm'
  | 'bodyTop'
  | 'neckJointMechanism'
  | 'neckPreset'
  | 'bridgePreset'
  | 'pickups'
  | 'pickguards'
  | 'frontRoutes'
  | 'potentiometers'
  | 'switches'
  | 'instrumentAppearance'
> & {
  settings: Pick<GuitarProject['settings'], 'name' | 'finishStyle' | 'bodyColor' | 'pickguardColor' | 'showPickguard' | 'showControls'>;
};

export function projectForViewerLink(project: GuitarProject): ViewerLinkProject {
  const { name, finishStyle, bodyColor, pickguardColor, showPickguard, showControls } = project.settings;
  return {
    schemaVersion: project.schemaVersion,
    instrumentType: project.instrumentType,
    stringCount: project.stringCount,
    activeTemplateId: project.activeTemplateId,
    settings: { name, finishStyle, bodyColor, pickguardColor, showPickguard, showControls },
    contour: project.contour,
    edgeProfile: project.edgeProfile,
    binding: project.binding,
    bodyThicknessMm: project.bodyThicknessMm,
    bodyTop: project.bodyTop,
    neckJointMechanism: project.neckJointMechanism,
    neckPreset: project.neckPreset,
    bridgePreset: project.bridgePreset,
    pickups: project.pickups,
    pickguards: project.pickguards,
    frontRoutes: project.frontRoutes,
    potentiometers: project.potentiometers,
    switches: project.switches,
    instrumentAppearance: project.instrumentAppearance,
  };
}

/**
 * Builds the self-contained "/viewer3d/#v=2&d=..." path for a project.
 *
 * The viewer renders the body top from the document's own
 * `bodyTop.construction`, so there is one 3D entry point. Its `?arch=1`
 * prototype tools are not linked from here: they tune values the viewer keeps
 * to itself, and nothing they change can reach a precision 2D plan.
 */
export async function buildViewer3DPath(project: GuitarProject): Promise<string> {
  const compressed = await deflate(new TextEncoder().encode(JSON.stringify(projectForViewerLink(project))));
  return `/viewer3d/#v=2&d=${toBase64Url(compressed)}`;
}
