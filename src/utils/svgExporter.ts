import { BRIDGE_PRESETS, NECK_PRESETS, PICKUP_SPECIFICATIONS } from '../constants/hardware';
import type { GuitarProject } from '../types/guitar';
import { anchorsToSVGPath } from './bezier';

export function exportProjectToSVG(project: GuitarProject): string {
  const { contour, neckPresetId, bridgePresetId, pickups, settings } = project;
  const neck = NECK_PRESETS[neckPresetId] || NECK_PRESETS.fender_strat_21;
  const bridge = BRIDGE_PRESETS[bridgePresetId] || BRIDGE_PRESETS.tremolo_strat;

  // Compute bounding box mm
  const bodyPath = anchorsToSVGPath(contour.anchors, contour.closed);
  
  // Calculate theoretical saddle Y mm
  const theoreticalSaddleY = neck.scaleLengthMm - neck.nutToJointMm;
  const bridgeY = theoreticalSaddleY + bridge.compensationMm.treble;

  const isHorizontal = settings.canvasOrientation === 'horizontal';
  
  // ViewBox bounds (mm): Vertical (400x550mm) vs Horizontal (550x400mm)
  const viewWidthMm = isHorizontal ? 550 : 400;
  const viewHeightMm = isHorizontal ? 400 : 550;
  const minX = isHorizontal ? -450 : -200;
  const minY = isHorizontal ? -200 : -50;

  const groupTransform = isHorizontal
    ? `transform="translate(0, 0) rotate(90)"`
    : `transform="translate(0, 0)"`;

  const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg 
  xmlns="http://www.w3.org/2000/svg" 
  width="${viewWidthMm}mm" 
  height="${viewHeightMm}mm" 
  viewBox="${minX} ${minY} ${viewWidthMm} ${viewHeightMm}"
>
  <metadata>
    <project:name>${settings.name}</project:name>
    <project:units>millimeters</project:units>
    <project:schemaVersion>${project.schemaVersion}</project:schemaVersion>
    <project:appVersion>${project.appVersion}</project:appVersion>
  </metadata>

  <style>
    .body-line { fill: none; stroke: #111111; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
    .neck-pocket { fill: none; stroke: #dc3545; stroke-width: 1.2; stroke-dasharray: 4,4; }
    .pickup-rout { fill: none; stroke: #28a745; stroke-width: 1.0; }
    .bridge-rout { fill: none; stroke: #007bff; stroke-width: 1.2; }
    .center-axis { fill: none; stroke: #6c757d; stroke-width: 0.5; stroke-dasharray: 6,4; opacity: 0.7; }
    .calibration-box { fill: none; stroke: #d9534f; stroke-width: 0.8; stroke-dasharray: 3,3; }
    .text-label { font-family: monospace, sans-serif; font-size: 6px; fill: #d9534f; }
    .title-label { font-family: sans-serif; font-size: 10px; font-weight: bold; fill: #222222; }
  </style>

  <!-- Title & Info Metadata Block -->
  <text x="${minX + 15}" y="${minY + 25}" class="title-label">${settings.name} - 1:1 Scale Print Template</text>
  <text x="${minX + 15}" y="${minY + 38}" class="text-label">Scale: ${neck.scaleLengthMm.toFixed(1)}mm (${(neck.scaleLengthMm / 25.4).toFixed(2)}") | Joint: ${neck.jointWidthMm}mm W x ${neck.jointDepthMm}mm D</text>
  <text x="${minX + 15}" y="${minY + 48}" class="text-label">Date: ${new Date().toISOString().split('T')[0]} | Printable 100% True Scale (Do Not Scale Page)</text>

  <!-- 100mm x 100mm Ruler Calibration Box -->
  <g transform="translate(${minX + 15}, 380)">
    <rect x="0" y="0" width="100" height="100" class="calibration-box" />
    <text x="5" y="15" class="text-label" font-weight="bold">CALIBRATION BOX</text>
    <text x="5" y="30" class="text-label">100 mm x 100 mm</text>
    <text x="5" y="45" class="text-label">Measure with ruler</text>
    <text x="5" y="60" class="text-label">to verify 100% print</text>
  </g>

  <!-- Guitar Geometry Group -->
  <g ${groupTransform}>
    <!-- Centerline Alignment Axis (X = 0) -->
    <line x1="0" y1="-50" x2="0" y2="500" class="center-axis" />

    <!-- Joint Line Marker (Y = 0) -->
    <line x1="-150" y1="0" x2="150" y2="0" class="center-axis" />
    <text x="155" y="3" class="text-label" fill="#6c757d">Y=0 (Joint Line)</text>

    <!-- Theoretical Saddle Line Marker -->
    <line x1="-100" y1="${theoreticalSaddleY}" x2="100" y2="${theoreticalSaddleY}" class="center-axis" stroke="#007bff" />
    <text x="105" y="${theoreticalSaddleY + 3}" class="text-label" fill="#007bff">Scale Line (${theoreticalSaddleY.toFixed(1)}mm)</text>

    <!-- Outer Custom Body Profile -->
    <path d="${bodyPath}" class="body-line" />

    <!-- Immutable Neck Pocket Cavity -->
    <rect 
      x="-${neck.jointWidthMm / 2}" 
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
        const spec = PICKUP_SPECIFICATIONS[p.type] || PICKUP_SPECIFICATIONS.single_coil;
        const w = spec.widthMm;
        const h = spec.heightMm;
        const rx = spec.cornerRadiusMm;
        return `
          <g transform="translate(${p.offsetXMm}, ${p.offsetYMm}) rotate(${p.angleDegrees})">
            <rect x="-${w / 2}" y="-${h / 2}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" class="pickup-rout" />
            <circle cx="0" cy="0" r="1.5" fill="#28a745" />
          </g>
        `;
      })
      .join('')}

    <!-- Bridge Hardware Plate & Mounting Holes -->
    <g transform="translate(0, ${bridgeY})">
      <rect x="-${bridge.widthMm / 2}" y="-10" width="${bridge.widthMm}" height="${bridge.lengthMm}" class="bridge-rout" />
      ${bridge.mountingPoints
        .map(
          (pt) => `<circle cx="${pt.x}" cy="${pt.y}" r="2" fill="#007bff" />`
        )
        .join('')}
    </g>
  </g>
</svg>`;

  return svgContent;
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
