import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { chooserHeading, projectNameField } from './helpers';

// Schema 10: knob type and finish, and pickguard finish
// (docs/AXE_SVG_FORMAT.md, "Version 10"). Choosing them is behind
// VITE_SCHEMA_10_AUTHORING, which this build turns on.

const source = readFileSync('tests/fixtures/ios-written-v5/controls.axe.svg', 'utf8');
const payload = JSON.parse(Buffer.from(source.match(/<project:data>(.*?)<\/project:data>/s)![1], 'base64').toString());
const square = (x: number, y: number) => [
  [x, y], [x + 100, y], [x + 100, y + 100], [x, y + 100],
].map(([x, y], i) => ({ id: `pg${i}`, position: { x, y }, handleMode: 'corner' }));

function decode(svg: string) {
  return JSON.parse(Buffer.from(svg.match(/<project:data>(.*?)<\/project:data>/s)![1], 'base64').toString());
}

async function openDesign(page: Page, svg: string) {
  await page.goto('/app');
  await expect(chooserHeading(page)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({ name: 'finishes.axe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
  await expect(projectNameField(page)).toBeVisible();
}

async function saveDesign(page: Page): Promise<string> {
  await page.getByRole('button', { name: /^Save/ }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: /Continue|Save/i }).last().click();
  return readFileSync((await (await downloaded).path())!, 'utf8');
}

test('knob and pickguard finishes are chosen, saved at 10 and reopened', async ({ page }) => {
  const data = structuredClone(payload);
  data.activeTemplateId = 's_style';
  data.settings = { ...data.settings, canvasOrientation: 'vertical', showControls: true };
  data.pickguards = [{ id: 'pg', name: 'Finish test guard', colorHex: '#ffffff', contour: { closed: true, anchors: square(220, 20) } }];
  data.potentiometers = [
    { id: 'vol', position: { x: 80, y: 240 }, bodyDiameterMm: 24, knobStyleId: 'generic' },
    { id: 'tone', position: { x: 80, y: 270 }, bodyDiameterMm: 24, knobStyleId: 'generic' },
  ];
  data.switches = [];
  data.jacks = [];
  await openDesign(page, source.replace(/<project:data>.*?<\/project:data>/s,
    `<project:data>${Buffer.from(JSON.stringify(data)).toString('base64')}</project:data>`));

  // The pickguard: a new guard's white colour reads as the White finish.
  await page.getByRole('tab', { name: 'Layers', exact: true }).click();
  await page.getByText('Finish test guard', { exact: true }).click();
  const guardFinish = page.locator('#pickguard-finish');
  await expect(guardFinish).toHaveValue('white');
  await guardFinish.selectOption('gold');
  await expect(guardFinish).toHaveValue('gold');

  // A knob, selected straight from the pickguard layer: the pickers show the
  // S-style family's knob until one is chosen.
  const canvas = page.locator('.konvajs-content');
  const box = (await canvas.boundingBox())!;
  const selectKnob = async () => {
    await page.mouse.click(box.x + box.width / 2 + 80 * 1.2, box.y + 120 + 240 * 1.2);
    await expect(page.getByText('Potentiometer', { exact: true })).toBeVisible();
  };
  await selectKnob();
  const knob = page.getByRole('combobox', { name: 'Knob', exact: true });
  const knobFinish = page.locator('#knob-finish');
  await expect(knob).toHaveValue('skirted');
  await expect(knobFinish).toHaveValue('white');
  await knob.selectOption('top_hat');
  await knobFinish.selectOption('chrome');
  await expect(page.getByText(/apply to all knobs/)).toBeVisible();
  // Each choice is its own undo step. Undo clears the selection.
  await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
  await selectKnob();
  await expect(knobFinish).toHaveValue('white');
  await expect(knob).toHaveValue('top_hat');
  await page.getByTitle('Redo (Ctrl+Y)', { exact: true }).click();
  await selectKnob();
  await expect(knobFinish).toHaveValue('chrome');

  const saved = decode(await saveDesign(page));
  expect(saved.schemaVersion).toBe(10);
  expect(saved.pickguards[0]).toMatchObject({ finish: 'gold', colorHex: '#d4af37' });
  for (const pot of saved.potentiometers) expect(pot).toMatchObject({ knobStyleId: 'top_hat', knobFinish: 'chrome' });
});
