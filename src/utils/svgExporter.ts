import type { BridgePreset, GuitarProject, LengthMm } from '../types/guitar';
import { anchorsToSVGPath } from './bezier';
import { bevelInsetLoop, closedPolylineToSVGPath } from './bevelIntensity';
import {
  resolveBridgePreset,
  resolveNeckPreset,
  resolvePickupSpec,
  withEmbeddedPresets,
} from './presets';
import {
  getMountingPointOriginYMm,
  getSaddleYMm,
  getTheoreticalSaddleYMm,
} from './scaleMath';
import {
  bridgeDrawingBoundsPoints,
  bridgeMountingPointsAreVisible,
  bridgeReferenceLineXRange,
  getBridgeDrawingGeometry,
  type BridgeDrawingGeometry,
  type BridgeDrawingRect,
} from './bridgeDrawing';

/** Namespace for the <project:*> metadata elements. Must be declared or the file is not well-formed XML. */
const PROJECT_NS = 'https://axe-shaper.app/ns/project/1';

/** Page padding around the drawn geometry, in mm. */
const PAGE_PADDING_MM = 15;
/** Extra room on the right of the geometry for the axis line labels, in mm. */
const LABEL_MARGIN_MM = 80;
/** Height of the title + calibration band appended below the geometry, in mm. */
const INFO_BAND_MM = 181;
/** Minimum page width so the 100mm calibration box always fits, in mm. */
const MIN_PAGE_WIDTH_MM = 220;

interface BoundsMm {
  minX: LengthMm;
  minY: LengthMm;
  maxX: LengthMm;
  maxY: LengthMm;
}

function bridgeRectSVG(rectangle: BridgeDrawingRect): string {
  const x = rectangle.center.x - rectangle.widthMm / 2;
  const y = rectangle.center.y - rectangle.heightMm / 2;
  const rotation = rectangle.angleDegrees === 0
    ? ''
    : ` transform="rotate(${rectangle.angleDegrees} ${rectangle.center.x.toFixed(2)} ${rectangle.center.y.toFixed(2)})"`;
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${rectangle.widthMm.toFixed(2)}" height="${rectangle.heightMm.toFixed(2)}" rx="${rectangle.cornerRadiusMm.toFixed(2)}" ry="${rectangle.cornerRadiusMm.toFixed(2)}" class="bridge-rout"${rotation} />`;
}

function bridgeHardwareSVG(
  geometry: BridgeDrawingGeometry,
  bridge: BridgePreset,
  theoreticalSaddleY: number,
  mountingOriginY: number
): string {
  let hardware: string;
  switch (geometry.kind) {
    case 'f-style': {
      const path = geometry.plateOutline
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ');
      hardware = [
        `<path d="${path} Z" class="bridge-rout" />`,
        bridgeRectSVG(geometry.saddleHousing),
        `<circle cx="${geometry.armSocket.center.x.toFixed(2)}" cy="${geometry.armSocket.center.y.toFixed(2)}" r="${geometry.armSocket.radiusMm.toFixed(2)}" class="bridge-rout" />`,
      ].join('\n      ');
      break;
    }
    case 'tom':
      hardware = [bridgeRectSVG(geometry.bridgeBar), bridgeRectSVG(geometry.tailpiece)].join('\n      ');
      break;
    case 'generic':
      hardware = [bridgeRectSVG(geometry.bridgePlate), bridgeRectSVG(geometry.saddlePlate)].join('\n      ');
      break;
  }

  const [lineMinX, lineMaxX] = bridgeReferenceLineXRange(geometry);
  const mountingPoints = bridgeMountingPointsAreVisible(geometry)
    ? (bridge.mountingPoints ?? [])
        .map((point) => `<circle cx="${point.x}" cy="${point.y}" r="2" fill="#007bff" />`)
        .join('')
    : '';
  return `${hardware}
      <line x1="${lineMinX.toFixed(2)}" y1="${theoreticalSaddleY.toFixed(2)}" x2="${lineMaxX.toFixed(2)}" y2="${theoreticalSaddleY.toFixed(2)}" stroke="#dc3545" stroke-width="1.2" />
      <g transform="translate(0, ${mountingOriginY.toFixed(2)})">${mountingPoints}</g>`;
}

/** Escape a string for safe interpolation into XML text or attribute values. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Round-trip project data is base64-encoded rather than placed in a CDATA
 * section - CDATA has no escape mechanism for a literal "]]>" and a project
 * name/author string could theoretically contain one.
 */
function encodeProjectData(project: GuitarProject): string {
  const bytes = new TextEncoder().encode(JSON.stringify(project));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeProjectData(base64: string): GuitarProject {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as GuitarProject;
}

/**
 * Pulls the embedded project data back out of a previously exported SVG.
 * Returns null if the file has no Axe Shaper metadata (foreign SVG, or the
 * metadata was stripped by another editor's re-save) rather than throwing -
 * callers should treat that as "not an Axe Shaper file", not a parse error.
 */
export function extractProjectFromSVG(svgText: string): GuitarProject | null {
  try {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    if (doc.querySelector('parsererror')) return null;
    const dataEl = doc.getElementsByTagNameNS(PROJECT_NS, 'data')[0];
    if (!dataEl?.textContent) return null;
    return decodeProjectData(dataEl.textContent.trim());
  } catch {
    return null;
  }
}

/**
 * Bounding box of everything drawn in model space (mm), so the page always
 * contains the whole design no matter how far the contour has been edited.
 * Bezier control points are included, which bounds the curve conservatively.
 */
function getContentBoundsMm(project: GuitarProject): BoundsMm {
  const { contour, pickups, pickguards, frontRoutes, backRoutes } = project;
  const neck = resolveNeckPreset(project);
  const bridge = resolveBridgePreset(project);

  const bounds: BoundsMm = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const add = (x: LengthMm, y: LengthMm) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };
  const addContourBounds = (anchors: typeof contour.anchors) => {
    for (const anchor of anchors) {
      add(anchor.position.x, anchor.position.y);
      if (anchor.handleIn) add(anchor.position.x + anchor.handleIn.x, anchor.position.y + anchor.handleIn.y);
      if (anchor.handleOut) add(anchor.position.x + anchor.handleOut.x, anchor.position.y + anchor.handleOut.y);
    }
  };

  // Body contour: anchors plus their handle control points
  addContourBounds(contour.anchors);

  // Pickguard and routed-cavity contours - same shape as the body contour
  for (const shape of [...(pickguards ?? []), ...(frontRoutes ?? []), ...(backRoutes ?? [])]) {
    addContourBounds(shape.contour.anchors);
  }

  // Centerline and joint line markers
  add(0, 0);
  add(-neck.jointWidthMm / 2, 0);
  add(neck.jointWidthMm / 2, neck.jointDepthMm);

  // Bridge silhouettes, theoretical scale-length line, mounting holes
  const bridgeDrawing = getBridgeDrawingGeometry(neck, bridge);
  for (const point of bridgeDrawingBoundsPoints(bridgeDrawing)) add(point.x, point.y);
  add(0, getTheoreticalSaddleYMm(neck));
  // `?? []` because an embedded bridge copy need not carry them — see the
  // note on BridgePreset.mountingPoints. Same defensive shape as
  // `project.pickups ?? []` in withEmbeddedPresets, and for the same reason:
  // a foreign file is not obliged to populate every field of our type.
  const mountingOriginY = getMountingPointOriginYMm(neck, bridge);
  for (const pt of bridge.mountingPoints ?? []) {
    add(pt.x, mountingOriginY + pt.y);
  }

  // Pickup routs (use the diagonal so any rotation angle stays inside)
  for (const p of pickups) {
    const spec = resolvePickupSpec(p);
    const reach = Math.hypot(spec.widthMm, spec.heightMm) / 2;
    add(p.offsetXMm - reach, p.offsetYMm - reach);
    add(p.offsetXMm + reach, p.offsetYMm + reach);
  }

  // Degenerate project (no geometry at all): fall back to a sane sheet
  if (!Number.isFinite(bounds.minX)) {
    return { minX: -200, minY: -50, maxX: 200, maxY: 500 };
  }

  return bounds;
}

export function exportProjectToSVG(rawProject: GuitarProject): string {
  // Stamp the resolved hardware into the payload before encoding, so a saved
  // file always carries the geometry it was drawn with even if the in-memory
  // project came from a version 1 load and was never otherwise touched.
  const project = withEmbeddedPresets(rawProject);

  const { contour, pickups, pickguards, frontRoutes, backRoutes, settings } = project;
  const neck = resolveNeckPreset(project);
  const bridge = resolveBridgePreset(project);

  const bodyPath = anchorsToSVGPath(contour.anchors, contour.closed);
  const bevelInset = bevelInsetLoop(project);
  const bevelInsetPath = bevelInset ? closedPolylineToSVGPath(bevelInset) : '';

  // Scale-length geometry - identical to what the canvas draws
  const theoreticalSaddleY = getTheoreticalSaddleYMm(neck);
  const saddleY = getSaddleYMm(neck, bridge);
  const bridgeDrawing = getBridgeDrawingGeometry(neck, bridge);
  const mountingOriginY = getMountingPointOriginYMm(neck, bridge);
  const bridgeHardware = bridgeHardwareSVG(bridgeDrawing, bridge, theoreticalSaddleY, mountingOriginY);

  const isHorizontal = settings.canvasOrientation === 'horizontal';

  // Model-space page bounds (before any orientation rotation)
  const content = getContentBoundsMm(project);
  const model: BoundsMm = {
    minX: content.minX - PAGE_PADDING_MM,
    minY: content.minY - PAGE_PADDING_MM,
    maxX: content.maxX + LABEL_MARGIN_MM,
    maxY: content.maxY + PAGE_PADDING_MM,
  };

  // Horizontal orientation rotates the geometry by 90deg: (x, y) -> (-y, x)
  const geometry = isHorizontal
    ? {
        minX: -model.maxY,
        minY: model.minX,
        width: model.maxY - model.minY,
        height: model.maxX - model.minX,
      }
    : {
        minX: model.minX,
        minY: model.minY,
        width: model.maxX - model.minX,
        height: model.maxY - model.minY,
      };

  // The title + calibration band is appended below the geometry in page space,
  // so it lands inside the viewBox in both orientations.
  const viewMinX = geometry.minX;
  const viewMinY = geometry.minY;
  const viewWidthMm = Math.max(geometry.width, MIN_PAGE_WIDTH_MM);
  const viewHeightMm = geometry.height + INFO_BAND_MM;
  const bandTopY = geometry.minY + geometry.height;
  const bandLeftX = viewMinX + 12;

  const groupTransform = isHorizontal ? ' transform="rotate(90)"' : '';

  const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:project="${PROJECT_NS}"
  width="${viewWidthMm.toFixed(2)}mm"
  height="${viewHeightMm.toFixed(2)}mm"
  viewBox="${viewMinX.toFixed(2)} ${viewMinY.toFixed(2)} ${viewWidthMm.toFixed(2)} ${viewHeightMm.toFixed(2)}"
>
  <metadata>
    <project:name>${escapeXml(settings.name)}</project:name>
    <project:units>millimeters</project:units>
    <project:schemaVersion>${project.schemaVersion}</project:schemaVersion>
    <project:appVersion>${escapeXml(project.appVersion)}</project:appVersion>
    <project:data>${encodeProjectData(project)}</project:data>
  </metadata>

  <style>
    .body-line { fill: none; stroke: #111111; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .edge-inset { fill: none; stroke: #555555; stroke-width: 0.3; stroke-dasharray: 3,2; }
    .neck-pocket { fill: none; stroke: #dc3545; stroke-width: 1.2; stroke-dasharray: 4,4; }
    .pickup-rout { fill: none; stroke: #28a745; stroke-width: 1.0; }
    .bridge-rout { fill: none; stroke: #007bff; stroke-width: 1.2; }
    .back-route { fill: none; stroke: #9333ea; stroke-width: 1.0; stroke-dasharray: 3,3; }
    .front-route { fill: none; stroke: #9333ea; stroke-width: 1.0; }
    .pickguard { fill: #ffffff; fill-opacity: 0.35; stroke: #6b7280; stroke-width: 1.0; }
    .center-axis { fill: none; stroke: #6c757d; stroke-width: 0.5; stroke-dasharray: 6,4; opacity: 0.7; }
    .calibration-box { fill: none; stroke: #d9534f; stroke-width: 0.8; stroke-dasharray: 3,3; }
    .band-rule { fill: none; stroke: #adb5bd; stroke-width: 0.5; }
    .text-label { font-family: monospace, sans-serif; font-size: 5px; fill: #d9534f; }
    .disclaimer-label { font-family: monospace, sans-serif; font-size: 4.5px; font-style: italic; fill: #6c757d; }
    .axis-label { font-family: monospace, sans-serif; font-size: 5px; fill: #6c757d; }
    .title-label { font-family: sans-serif; font-size: 10px; font-weight: bold; fill: #222222; }
  </style>

  <!-- Guitar Geometry Group -->
  <g${groupTransform}>
    <!-- Centerline Alignment Axis (X = 0) -->
    <line x1="0" y1="${model.minY.toFixed(2)}" x2="0" y2="${model.maxY.toFixed(2)}" class="center-axis" />

    <!-- Joint Line Marker (Y = 0) -->
    <line x1="${model.minX.toFixed(2)}" y1="0" x2="${content.maxX.toFixed(2)}" y2="0" class="center-axis" />
    <text x="${(content.maxX + 4).toFixed(2)}" y="3" class="axis-label">Y=0 (Joint Line)</text>

    <!-- Theoretical Saddle Line Marker -->
    <line x1="${model.minX.toFixed(2)}" y1="${theoreticalSaddleY.toFixed(2)}" x2="${content.maxX.toFixed(2)}" y2="${theoreticalSaddleY.toFixed(2)}" class="center-axis" stroke="#007bff" />
    <text x="${(content.maxX + 4).toFixed(2)}" y="${(theoreticalSaddleY + 3).toFixed(2)}" class="axis-label" fill="#007bff">Scale Line (${theoreticalSaddleY.toFixed(1)}mm)</text>

    <!-- Back Routed Cavities (drawn under the body so a front view can't see them) -->
    ${(backRoutes ?? [])
      .filter((r) => r.visible !== false)
      .map((r) => `<path d="${anchorsToSVGPath(r.contour.anchors, r.contour.closed)}" class="back-route" />`)
      .join('')}

    <!-- Outer Custom Body Profile -->
    <path d="${bodyPath}" class="body-line" />
    ${bevelInsetPath ? `<path d="${bevelInsetPath}" class="edge-inset" />` : ''}

    <!-- Pickguard (translucent, above the body, under the hardware) -->
    ${(pickguards ?? [])
      .filter((p) => p.visible !== false)
      .map(
        (p) =>
          `<path d="${anchorsToSVGPath(p.contour.anchors, p.contour.closed)}" class="pickguard" style="fill:${escapeXml(p.colorHex ?? '#ffffff')}" />`
      )
      .join('')}

    <!-- Immutable Neck Pocket Cavity -->
    <rect
      x="${(-neck.jointWidthMm / 2).toFixed(2)}"
      y="0"
      width="${neck.jointWidthMm}"
      height="${neck.jointDepthMm}"
      rx="${neck.jointCornerRadiusMm}"
      ry="${neck.jointCornerRadiusMm}"
      class="neck-pocket"
    />

    <!-- Pickup Routing Cavities -->
    ${pickups
      .map((p) => {
        const { widthMm: w, heightMm: h, cornerRadiusMm: rx } = resolvePickupSpec(p);
        return `
          <g transform="translate(${p.offsetXMm}, ${p.offsetYMm}) rotate(${p.angleDegrees})">
            <rect x="${(-w / 2).toFixed(2)}" y="${(-h / 2).toFixed(2)}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" class="pickup-rout" />
            <circle cx="0" cy="0" r="1.5" fill="#28a745" />
          </g>
        `;
      })
      .join('')}

    <!-- Front Routed Cavities (control cavities, etc. - alongside the pickup routs) -->
    ${(frontRoutes ?? [])
      .filter((r) => r.visible !== false)
      .map((r) => `<path d="${anchorsToSVGPath(r.contour.anchors, r.contour.closed)}" class="front-route" />`)
      .join('')}

    <!-- Family-specific bridge hardware and scale-length reference line -->
    <g id="bridge-hardware">
      ${bridgeHardware}
    </g>
  </g>

  <!-- Title, Specs & Calibration Band (page space - never rotated) -->
  <g>
    <line x1="${viewMinX.toFixed(2)}" y1="${bandTopY.toFixed(2)}" x2="${(viewMinX + viewWidthMm).toFixed(2)}" y2="${bandTopY.toFixed(2)}" class="band-rule" />
    <text x="${bandLeftX.toFixed(2)}" y="${(bandTopY + 20).toFixed(2)}" class="title-label">${escapeXml(settings.name)} - 1:1 Scale Print Template</text>
    <text x="${bandLeftX.toFixed(2)}" y="${(bandTopY + 33).toFixed(2)}" class="text-label">Scale: ${neck.scaleLengthMm.toFixed(1)}mm (${(neck.scaleLengthMm / 25.4).toFixed(2)}") | Joint: ${neck.jointWidthMm}mm W x ${neck.jointDepthMm}mm D | Saddle Y: ${saddleY.toFixed(1)}mm</text>
    <text x="${bandLeftX.toFixed(2)}" y="${(bandTopY + 43).toFixed(2)}" class="text-label">Date: ${new Date().toISOString().split('T')[0]} | Printable 100% True Scale (Do Not Scale Page)</text>
    <text x="${bandLeftX.toFixed(2)}" y="${(bandTopY + 56).toFixed(2)}" class="disclaimer-label">Editing this file in another app will not update Axe Shaper - re-importing it may discard your changes.</text>

    <!-- 100mm x 100mm Ruler Calibration Box -->
    <g transform="translate(${bandLeftX.toFixed(2)}, ${(bandTopY + 68).toFixed(2)})">
      <rect x="0" y="0" width="100" height="100" class="calibration-box" />
      <text x="5" y="15" class="text-label" font-weight="bold">CALIBRATION BOX</text>
      <text x="5" y="30" class="text-label">100 mm x 100 mm</text>
      <text x="5" y="45" class="text-label">Measure with ruler</text>
      <text x="5" y="60" class="text-label">to verify 100% print</text>
    </g>
  </g>
</svg>`;

  return svgContent;
}

// Builds a save filename that's unique per save, so the browser's Downloads
// folder doesn't collide and silently rename the file to "name.axe (1).svg".
// The token is tenths-of-a-second since local midnight, zero-padded to 6
// decimal digits (max value 863999), so same-day filenames still sort
// chronologically as strings.
export function buildProjectFilename(projectName: string, date: Date = new Date()): string {
  const slug = projectName.toLowerCase().replace(/\s+/g, '-');
  const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const secondsSinceMidnight = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const tenths = secondsSinceMidnight * 10 + Math.floor(date.getMilliseconds() / 100);
  const token = tenths.toString().padStart(6, '0');
  return `${slug}-${localDate}-${token}.axe.svg`;
}

export function downloadSVGFile(filename: string, svgContent: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
