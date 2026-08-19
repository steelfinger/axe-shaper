import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function payloadFromFixture(fileName: string): any {
  const svg = readFileSync(resolve(root, 'tests/fixtures/ios-written', fileName), 'utf8');
  const encoded = svg.match(/<project:data>([\s\S]*?)<\/project:data>/)?.[1]?.trim();
  assert(encoded, `${fileName} has no project payload`);
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
}

const server = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const bridgeDrawing = await server.ssrLoadModule('/src/utils/bridgeDrawing.ts');
  const hardware = await server.ssrLoadModule('/src/constants/hardware.ts');
  const exporter = await server.ssrLoadModule('/src/utils/svgExporter.ts');

  const neck = hardware.NECK_PRESETS.fender_strat_21;
  const tremolo = hardware.BRIDGE_PRESETS.tremolo_strat;
  const fStyle = bridgeDrawing.getBridgeDrawingGeometry(neck, tremolo);
  assert.equal(fStyle.kind, 'f-style');
  assert.equal(Math.min(...fStyle.plateOutline.map((p: any) => p.x)), -36.5);
  assert.equal(Math.max(...fStyle.plateOutline.map((p: any) => p.x)), 46.5);
  assert.equal(fStyle.saddleHousing.widthMm, 71);
  assert.equal(fStyle.saddleHousing.heightMm, 34);
  assert.equal(fStyle.saddleHousing.center.x, -1);
  assert.deepEqual(bridgeDrawing.bridgeReferenceLineXRange(fStyle), [-37.5, 35.5]);
  assert.equal(fStyle.armSocket.center.x, 39.5);
  assert.equal(fStyle.armSocket.radiusMm, 3.5);

  const hardtailWithSameInputs = bridgeDrawing.getBridgeDrawingGeometry(neck, {
    ...tremolo,
    id: 'hardtail_6',
  });
  assert.deepEqual(hardtailWithSameInputs, fStyle);
  assert.equal(bridgeDrawing.bridgeMountingPointsAreVisible(fStyle), false);

  const tom = hardware.BRIDGE_PRESETS.tune_o_matic;
  const tomDrawing = bridgeDrawing.getBridgeDrawingGeometry(neck, tom);
  assert.equal(tomDrawing.kind, 'tom');
  assert.equal(tomDrawing.bridgeBar.cornerRadiusMm, tom.lengthMm / 2);
  assert.equal(tomDrawing.bridgeBar.angleDegrees, -3);
  assert.equal(tomDrawing.tailpiece.angleDegrees, 0);
  const corners = bridgeDrawing.rotatedRectCorners(tomDrawing.bridgeBar);
  assert(corners[0].y > corners[1].y, 'negative-X bass end must sit farther toward the tail');

  const fixture = payloadFromFixture('s_style.axe.svg');
  const tomSVG = exporter.exportProjectToSVG({
    ...fixture,
    neckPresetId: neck.id,
    neckPreset: neck,
    bridgePresetId: tom.id,
    bridgePreset: tom,
  });
  assert.match(tomSVG, /rx="7\.00"[^>]*transform="rotate\(-3 0\.00 [\d.]+\)"/);

  const hardtail = hardware.BRIDGE_PRESETS.hardtail_6;
  const fStyleSVG = exporter.exportProjectToSVG({
    ...fixture,
    neckPresetId: neck.id,
    neckPreset: neck,
    bridgePresetId: hardtail.id,
    bridgePreset: hardtail,
  });
  const bridgeGroup = fStyleSVG.match(/<g id="bridge-hardware">([\s\S]*?)<\/g>/)?.[1] ?? '';
  assert.match(bridgeGroup, /<path d="M -36\.50/);
  assert.match(bridgeGroup, /<circle cx="39\.50"[^>]*r="3\.50"/);
  assert.doesNotMatch(bridgeGroup, /cx="-21"/);

  console.log('Bridge drawing geometry and SVG output are consistent.');
} finally {
  await server.close();
}
