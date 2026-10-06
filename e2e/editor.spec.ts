import { readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  chooserHeading,
  expectCanvasDrawn,
  instrumentBadge,
  makeAnEdit,
  openEditor,
  projectNameField,
  trackPageErrors,
} from './helpers';

test.describe('opening a design', () => {
  test('a guitar blueprint opens to a drawn canvas', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openEditor(page, 'Guitar');
    await expect(instrumentBadge(page)).toContainText('Guitar');
    await expect(instrumentBadge(page)).toContainText('6-string');
    await expectCanvasDrawn(page);
    expect(errors).toEqual([]);
  });

  test('a bass blueprint opens as a bass, never as a guitar', async ({ page }) => {
    const errors = trackPageErrors(page);
    await openEditor(page, 'Bass');
    await expect(instrumentBadge(page)).toContainText('Bass');
    await expect(instrumentBadge(page)).toContainText('4-string');
    await expectCanvasDrawn(page);
    expect(errors).toEqual([]);
  });

  test('a blueprint card shows its description and opens the editor in one click', async ({ page }) => {
    await page.goto('/app');
    await expect(chooserHeading(page)).toBeVisible();
    const card = page.locator('button.design-card').nth(1);
    await expect(card.locator('.design-card-description')).not.toBeEmpty();
    await card.click();
    await expect(projectNameField(page)).toBeVisible();
  });
});

test.describe('?plan= deep link', () => {
  test('opens the plan directly, without showing the chooser, and strips the parameter', async ({ page }) => {
    const errors = trackPageErrors(page);
    await page.goto('/app?plan=/marketing/custom-s-style-plan.axe.svg');
    await expect(projectNameField(page)).toBeVisible();
    await expect(chooserHeading(page)).toHaveCount(0);
    await expectCanvasDrawn(page);
    await expect.poll(() => new URL(page.url()).search).toBe('');
    expect(errors).toEqual([]);
  });

  test('a plan that is not there falls back to the chooser and says so', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });
    // The host serves the SPA shell with status 200 for a missing file.
    await page.goto('/app?plan=/marketing/does-not-exist.axe.svg');
    await expect(chooserHeading(page)).toBeVisible();
    await expect(projectNameField(page)).toHaveCount(0);
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toMatch(/Choose a blueprint/);
  });

  test('an off-site plan is ignored outright', async ({ page }) => {
    let requested = false;
    await page.route('https://evil.example/**', (route) => {
      requested = true;
      return route.abort();
    });
    await page.goto('/app?plan=https://evil.example/x.axe.svg');
    await expect(chooserHeading(page)).toBeVisible();
    expect(requested).toBe(false);
  });
});

test.describe('leaving the editor', () => {
  test('browser Back from a clean editor returns to the chooser, still on /app', async ({ page }) => {
    await openEditor(page);
    await page.goBack();
    await expect(chooserHeading(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/app');
  });

  test('browser Back with unsaved changes asks first, and cancelling keeps the work', async ({ page }) => {
    await openEditor(page);
    await makeAnEdit(page);

    const messages: string[] = [];
    let accept = false;
    page.on('dialog', async (dialog) => {
      messages.push(dialog.message());
      await (accept ? dialog.accept() : dialog.dismiss());
    });

    await page.goBack();
    await expect.poll(() => messages.length).toBe(1);
    await expect(projectNameField(page)).toHaveValue('Edited by a smoke test');
    await expect(chooserHeading(page)).toHaveCount(0);

    // The entry was restored, so Back still guards the work.
    await page.goBack();
    await expect.poll(() => messages.length).toBe(2);
    await expect(projectNameField(page)).toBeVisible();

    accept = true;
    await page.goBack();
    await expect(chooserHeading(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/app');
  });

  test('the instrument badge reopens the chooser on that instrument', async ({ page }) => {
    await openEditor(page, 'Bass');
    await instrumentBadge(page).click(); // clean document: no confirm
    await expect(chooserHeading(page)).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Bass/ })).toBeChecked();
  });

  test('New... on a dirty document asks first', async ({ page }) => {
    await openEditor(page);
    await makeAnEdit(page);
    const messages: string[] = [];
    page.on('dialog', async (dialog) => {
      messages.push(dialog.message());
      await dialog.dismiss();
    });
    await page.getByTitle('Start a new design').click();
    await expect.poll(() => messages.length).toBe(1);
    await expect(projectNameField(page)).toBeVisible();
  });
});

test.describe('saving', () => {
  test('a saved file reopens as the same design', async ({ page }) => {
    await openEditor(page);
    await projectNameField(page).fill('Round trip');
    await projectNameField(page).blur();

    await page.getByRole('button', { name: /^Save/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Continue|Save/i }).last().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.axe\.svg$/);
    const path = await download.path();

    // Saving clears the unsaved flag, so leaving does not prompt.
    await instrumentBadge(page).click();
    await expect(chooserHeading(page)).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles(path);
    await expect(projectNameField(page)).toHaveValue('Round trip');
    await expectCanvasDrawn(page);
  });
});

test.describe('files written by the iPad app', () => {
  // Their synthetic fixtures carry only four settings keys. Opening one used
  // to throw on `settings.symmetry.mode` and leave a blank page.
  for (const name of ['controls', 'solid_body_carve']) {
    test(`${name}.axe.svg opens to a drawn canvas`, async ({ page }) => {
      const errors = trackPageErrors(page);
      await page.goto('/app');
      await expect(chooserHeading(page)).toBeVisible();
      await page.locator('input[type="file"]').setInputFiles(`tests/fixtures/ios-written-v5/${name}.axe.svg`);
      await expect(projectNameField(page)).toBeVisible();
      await expectCanvasDrawn(page);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('output jacks (schema 8) behind the release gate', () => {
  // OUTPUT_JACKS_ENABLED is off in this build, and no `v*` tag may turn it on
  // before an iPad release that reads schema 8 is live. Authoring is hidden,
  // but a file that already carries jacks must still open, list and draw them.
  test('the default build offers no Output Jack action, yet opens a file that has jacks', async ({ page }, testInfo) => {
    const errors = trackPageErrors(page);
    await openEditor(page);
    await page.getByRole('tab', { name: 'Hardware', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Potentiometer', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Output Jack', exact: true })).toHaveCount(0);

    // A web-saved file is the realistic base; add jacks to its payload the way
    // a build with the flag on would have written them.
    await page.getByRole('button', { name: /^Save/ }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Continue|Save/i }).last().click();
    const saved = readFileSync((await (await downloadPromise).path())!, 'utf8');
    const payload = /<project:data>([^<]*)<\/project:data>/.exec(saved)!;
    const project = JSON.parse(Buffer.from(payload[1], 'base64').toString('utf8'));
    project.schemaVersion = 8;
    project.jacks = [
      { id: 'plate', position: { x: 40, y: 200 }, mountingStyle: 'strat_plate', angleDegrees: 25 },
      { id: 'direct', position: { x: -30, y: 230 }, mountingStyle: 'direct', angleDegrees: 33 },
      { id: 'odd', position: { x: 0, y: 260 }, mountingStyle: 'side_mounted', angleDegrees: 0 },
    ];
    const withJacks = saved
      .replace(payload[1], Buffer.from(JSON.stringify(project)).toString('base64'))
      .replace(/<project:schemaVersion>\d+</, '<project:schemaVersion>8<');
    const file = testInfo.outputPath('with-jacks.axe.svg');
    writeFileSync(file, withJacks);

    await instrumentBadge(page).click();
    await expect(chooserHeading(page)).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(file);
    await expectCanvasDrawn(page);
    await page.getByRole('tab', { name: 'Hardware', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Output Jack · Strat plate 1/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Output Jack · Direct/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Output Jack · unknown style/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Output Jack', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
