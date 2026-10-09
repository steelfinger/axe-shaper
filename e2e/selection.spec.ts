import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { chooserHeading, projectNameField } from './helpers';

const source = readFileSync('tests/fixtures/ios-written-v5/controls.axe.svg', 'utf8');
const payload = JSON.parse(Buffer.from(source.match(/<project:data>(.*?)<\/project:data>/s)![1], 'base64').toString());
const anchors = (x: number, y: number) => [
  [x, y], [x + 100, y], [x + 100, y + 100], [x, y + 100],
].map(([x, y], i) => ({ id: `pg${i}`, position: { x, y }, handleMode: 'corner' }));

for (const input of ['mouse', 'finger'] as const) {
  test.describe(input, () => {
    test.use({ hasTouch: input === 'finger' });
    for (const [kind, x, y, inspector] of [
      ['pickup', 0, 180, 'Pickup Inspector'],
      ['pot', 80, 240, 'Potentiometer'],
      ['toggle', -80, 240, 'Selector Switch'],
      ['jack', 80, 300, 'Output Jack'],
      ['overlap', 270, 20, 'Segment Inspector'],
      ['hidden', 80, 240, 'Node Inspector'],
      ['pan', 80, 240, 'Node Inspector'],
    ] as const) {
      test(`${kind} uses layer-aware selection from pickguard`, async ({ page }) => {
        const data = structuredClone(payload);
        data.settings = { ...data.settings, canvasOrientation: 'vertical', showHardwareCavities: true, showControls: true };
        data.pickguards = [{ id: 'pg', name: 'Selection test guard', contour: { closed: true, anchors: anchors(220, 20) } }];
        data.potentiometers = [{ id: 'pot', position: { x: 80, y: 240 }, bodyDiameterMm: 24 }];
        data.switches = [{ id: 'toggle', type: 'gibson_toggle', position: { x: -80, y: 240 }, angleDegrees: 20 }];
        data.jacks = [{ id: 'jack', position: { x: 80, y: 300 }, mountingStyle: 'direct', angleDegrees: 0 }];
        if (kind === 'overlap') data.potentiometers[0].position = { x, y };
        if (kind === 'hidden') data.settings.showControls = false;
        data.schemaVersion = 8;
        const svg = source.replace(/<project:data>.*?<\/project:data>/s, `<project:data>${Buffer.from(JSON.stringify(data)).toString('base64')}</project:data>`);
        await page.goto('/app');
        await expect(chooserHeading(page)).toBeVisible();
        await page.locator('input[type="file"]').setInputFiles({ name: 'selection.axe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
        await expect(projectNameField(page)).toBeVisible();
        await page.getByRole('tab', { name: 'Layers', exact: true }).click();
        await page.getByText('Selection test guard', { exact: true }).click();
        await expect(page.getByRole('button', { name: 'Body Outline (editing)', exact: true })).toHaveCount(0);
        if (kind === 'pan') await page.getByRole('button', { name: 'Pan (P)', exact: true }).click();
        const canvas = page.locator('.konvajs-content');
        const box = (await canvas.boundingBox())!;
        const point = { x: box.x + box.width / 2 + x * 1.2, y: box.y + 120 + y * 1.2 };
        if (input === 'finger') await page.touchscreen.tap(point.x, point.y);
        else await page.mouse.click(point.x, point.y);
        const body = page.getByRole('button', { name: 'Body Outline (editing)', exact: true });
        if (['overlap', 'hidden', 'pan'].includes(kind)) await expect(body).toHaveCount(0);
        else await expect(body).toBeVisible();
        await expect(page.getByText(inspector, { exact: true })).toBeVisible();
      });
    }
  });
}
