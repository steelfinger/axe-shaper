import type { GuitarProject } from '../types/guitar';

// Fragment contract shared with the standalone 3D viewer
// (steelfinger/axe-shape-3D-viewer, deployed at /viewer3d). Never sent over
// the network: everything after "#" stays in the browser. #d=<payload> is a
// self-contained link — the project JSON, deflate-raw compressed, then
// base64url encoded. Keep this in sync with that repo's src/core/shareLink.ts.

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
 * Builds the self-contained "/viewer3d/#d=..." path for a project.
 *
 * The viewer renders the body top from the document's own
 * `bodyTop.construction`, so there is one 3D entry point. Its `?arch=1`
 * prototype tools are not linked from here: they tune values the viewer keeps
 * to itself, and nothing they change can reach a precision 2D plan.
 */
export async function buildViewer3DPath(project: GuitarProject): Promise<string> {
  const compressed = await deflate(new TextEncoder().encode(JSON.stringify(project)));
  return `/viewer3d/#d=${toBase64Url(compressed)}`;
}
