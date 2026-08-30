/**
 * Transcribes the blue cavity paths from the user-maintained SVG sheet into
 * PathAnchor data. It supports exactly the commands used by the sheet
 * (M/L/H/V/C/Z, absolute and relative) and retains every cubic control point.
 *
 * Usage:
 *   npx tsx scripts/import-bass-cavities.ts /absolute/path/to/no-rect-cavities.svg src/constants/bassCavityAnchors.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';

type Point = { x: number; y: number };
type Anchor = {
  id: string;
  position: Point;
  handleIn?: Point;
  handleOut?: Point;
  handleMode: 'corner';
};

const source = process.argv[2];
const destination = process.argv[3];
if (!source) throw new Error('Pass the cavity SVG path.');

const CAVITIES = {
  'P-Style Cavity': 'bass_split_coil',
  'J-Style Cavity': 'bass_j_single_coil',
  'MM-Style Cavity': 'bass_humbucker',
} as const;

const number = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/y;
const command = /[a-zA-Z]/y;

function tokens(path: string): Array<string | number> {
  const result: Array<string | number> = [];
  let index = 0;
  while (index < path.length) {
    if (/[\s,]/.test(path[index])) {
      index += 1;
      continue;
    }
    command.lastIndex = index;
    const commandMatch = command.exec(path);
    if (commandMatch) {
      result.push(commandMatch[0]);
      index += 1;
      continue;
    }
    number.lastIndex = index;
    const numberMatch = number.exec(path);
    if (numberMatch) {
      result.push(Number(numberMatch[0]));
      index += numberMatch[0].length;
      continue;
    }
    throw new Error(`Unsupported SVG token at character ${index}: ${path.slice(index, index + 12)}`);
  }
  return result;
}

function importPath(path: string, idPrefix: string): { widthMm: number; heightMm: number; anchors: Anchor[] } {
  const sourceTokens = tokens(path);
  const anchors: Anchor[] = [];
  let tokenIndex = 0;
  let activeCommand = '';
  let current: Point = { x: 0, y: 0 };

  const nextNumber = () => {
    const value = sourceTokens[tokenIndex++];
    if (typeof value !== 'number') throw new Error(`Expected number in ${idPrefix} path.`);
    return value;
  };
  const addAnchor = (position: Point) => {
    anchors.push({ id: `${idPrefix}_a${anchors.length}`, position, handleMode: 'corner' });
    current = position;
  };
  const relative = (isRelative: boolean, point: Point): Point => isRelative
    ? { x: current.x + point.x, y: current.y + point.y }
    : point;

  while (tokenIndex < sourceTokens.length) {
    if (typeof sourceTokens[tokenIndex] === 'string') activeCommand = sourceTokens[tokenIndex++] as string;
    if (!activeCommand) throw new Error(`Missing SVG command in ${idPrefix} path.`);
    const isRelative = activeCommand === activeCommand.toLowerCase();
    const op = activeCommand.toUpperCase();
    if (op === 'Z') {
      activeCommand = '';
      continue;
    }
    if (op === 'M' || op === 'L') {
      const point = relative(isRelative, { x: nextNumber(), y: nextNumber() });
      addAnchor(point);
      // SVG treats extra coordinate pairs after M as line-to commands.
      if (op === 'M') activeCommand = isRelative ? 'l' : 'L';
      continue;
    }
    if (op === 'H') {
      addAnchor({ x: isRelative ? current.x + nextNumber() : nextNumber(), y: current.y });
      continue;
    }
    if (op === 'V') {
      addAnchor({ x: current.x, y: isRelative ? current.y + nextNumber() : nextNumber() });
      continue;
    }
    if (op === 'C') {
      const start = current;
      const control1 = relative(isRelative, { x: nextNumber(), y: nextNumber() });
      const control2 = relative(isRelative, { x: nextNumber(), y: nextNumber() });
      const end = relative(isRelative, { x: nextNumber(), y: nextNumber() });
      const previous = anchors.at(-1);
      if (!previous) throw new Error(`Cubic command before move-to in ${idPrefix} path.`);
      previous.handleOut = { x: control1.x - start.x, y: control1.y - start.y };
      addAnchor(end);
      anchors.at(-1)!.handleIn = { x: control2.x - end.x, y: control2.y - end.y };
      continue;
    }
    throw new Error(`Unsupported SVG command ${activeCommand} in ${idPrefix} path.`);
  }

  if (anchors.length < 3) throw new Error(`${idPrefix} path did not create a closed outline.`);
  const minX = Math.min(...anchors.map((anchor) => anchor.position.x));
  const maxX = Math.max(...anchors.map((anchor) => anchor.position.x));
  const minY = Math.min(...anchors.map((anchor) => anchor.position.y));
  const maxY = Math.max(...anchors.map((anchor) => anchor.position.y));
  const centre = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  for (const anchor of anchors) {
    anchor.position.x -= centre.x;
    anchor.position.y -= centre.y;
  }
  return { widthMm: maxX - minX, heightMm: maxY - minY, anchors };
}

function format(value: number): string {
  return Number(value.toFixed(6)).toString();
}

const svg = readFileSync(source, 'utf8');
const entries = Object.entries(CAVITIES).map(([label, id]) => {
  const tag = [...svg.matchAll(/<path\b[\s\S]*?\/>/g)].map((match) => match[0])
    .find((path) => path.includes(`inkscape:label="${label}"`));
  const path = tag?.match(/\sd="([^"]+)"/)?.[1];
  if (!path) throw new Error(`Missing ${label} in ${source}`);
  return [id, importPath(path, id)] as const;
});

const output: string[] = [];
const emit = (line = '') => output.push(line);

emit("import type { PickupRoutSpec } from '../types/guitar';");
emit();
emit('// Generated by scripts/import-bass-cavities.ts from no-rect-cavities.svg.');
emit('// Preserve these literal contours: bass pickup cavities follow the pickup housing.');
emit("export const BASS_CAVITY_SPECS: Record<'bass_split_coil' | 'bass_j_single_coil' | 'bass_humbucker', Omit<PickupRoutSpec, 'name'>> = {");
for (const [id, spec] of entries) {
  emit(`  ${id}: {`);
  emit(`    widthMm: ${format(spec.widthMm)},`);
  emit(`    heightMm: ${format(spec.heightMm)},`);
  emit('    anchors: [');
  for (const anchor of spec.anchors) {
    const parts = [
      `id: '${anchor.id}'`,
      `position: { x: ${format(anchor.position.x)}, y: ${format(anchor.position.y)} }`,
      anchor.handleIn && `handleIn: { x: ${format(anchor.handleIn.x)}, y: ${format(anchor.handleIn.y)} }`,
      anchor.handleOut && `handleOut: { x: ${format(anchor.handleOut.x)}, y: ${format(anchor.handleOut.y)} }`,
      "handleMode: 'corner'",
    ].filter(Boolean).join(', ');
    emit(`      { ${parts} },`);
  }
  emit('    ],');
  emit('  },');
}
emit('};');

if (destination) writeFileSync(destination, `${output.join('\n')}\n`);
else console.log(output.join('\n'));
