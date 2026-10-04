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

  test('clicking a blueprint card selects it and shows its description; Open editor opens it', async ({ page }) => {
    await page.goto('/app');
    await expect(chooserHeading(page)).toBeVisible();
    await page.locator('label.design-card').nth(1).click();
    await expect(chooserHeading(page)).toBeVisible();
    await expect(page.locator('.design-summary-text')).toContainText('scale');
    await page.getByRole('button', { name: /Open editor/ }).click();
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
