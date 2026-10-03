import { expect, test } from '@playwright/test';
import { openEditor, projectNameField } from './helpers';

// CLAUDE.md: "Every number is a measured point". These pin the measurement it
// asks for by hand - the project-name field must not be squeezed or clipped as
// the action row grows - at one width inside each header tier.
const LONG_NAME = 'A Fairly Long Project Name For Header Measuring';

for (const [width, minName] of [
  [1920, 200],
  [1512, 200],
  [1400, 170],
  [1300, 150],
] as const) {
  test(`header keeps the name field readable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openEditor(page);
    const field = projectNameField(page);
    await field.fill(LONG_NAME);

    const metrics = await page.evaluate(() => {
      const controls = document.querySelector('.header-project-controls') as HTMLElement;
      const input = controls.querySelector('input.form-input') as HTMLElement;
      return {
        controlsScroll: controls.scrollWidth,
        controlsClient: controls.clientWidth,
        inputWidth: input.getBoundingClientRect().width,
        pageScroll: document.documentElement.scrollWidth,
        pageClient: document.documentElement.clientWidth,
      };
    });

    expect(metrics.inputWidth).toBeGreaterThanOrEqual(minName);
    expect(metrics.controlsScroll).toBeLessThanOrEqual(metrics.controlsClient + 1);
    expect(metrics.pageScroll).toBeLessThanOrEqual(metrics.pageClient);
  });
}
