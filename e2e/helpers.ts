import { expect, type Page } from '@playwright/test';

/** Collects uncaught page errors so a flow fails on a crash that still renders something. */
export function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export const projectNameField = (page: Page) => page.locator('.header-project-controls input.form-input');
export const instrumentBadge = (page: Page) => page.locator('.header-instrument');
export const chooserHeading = (page: Page) => page.getByRole('heading', { name: 'New design', level: 1 });

/** From the chooser: pick an instrument (its first blueprint is preselected) and open the editor. */
export async function openEditor(page: Page, instrument: 'Guitar' | 'Bass' = 'Guitar') {
  await page.goto('/app');
  await expect(chooserHeading(page)).toBeVisible();
  // The radio itself is visually hidden behind its label face, as a user sees it.
  await page.locator('label.design-instrument-option', { hasText: instrument }).click();
  await page.getByRole('button', { name: /Open editor/ }).click();
  await expect(projectNameField(page)).toBeVisible();
}

/** A real edit through the UI, which is what marks the document unsaved. */
export async function makeAnEdit(page: Page) {
  const field = projectNameField(page);
  await field.fill('Edited by a smoke test');
  await field.blur();
}

/** The Konva stage has a real size and has drawn something. A 0-sized stage is a blank screen. */
export async function expectCanvasDrawn(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('.konvajs-content canvas'));
        if (canvases.length === 0) return 'no canvas';
        const sized = canvases.filter((c) => c.width > 1 && c.height > 1);
        if (sized.length === 0) return 'canvas has no size';
        const drawn = sized.some((c) => {
          const ctx = c.getContext('2d');
          if (!ctx) return false;
          const { data } = ctx.getImageData(0, 0, c.width, c.height);
          for (let i = 3; i < data.length; i += 4 * 97) if (data[i] !== 0) return true;
          return false;
        });
        return drawn ? 'drawn' : 'blank';
      })
    )
    .toBe('drawn');
}
