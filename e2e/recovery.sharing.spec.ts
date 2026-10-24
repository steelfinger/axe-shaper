import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const fixture = JSON.parse(readFileSync(new URL('../tests/fixtures/sharing/creation-v1.json', import.meta.url), 'utf8'));

const storageKey = `axe-shaper.sharing.pending.v1.${fixture.operationKey}`;
for (const outcome of ['expired', 'too-large', 'invalid-project', 'revoked']) {
  test(`${outcome} requests neither nag nor retry, and can be dismissed`, async ({ page }) => {
    let uploads = 0;
    page.on('request', request => { if (request.url().endsWith('/api/shares') && request.method() === 'POST') uploads++; });
    await page.addInitScript(({ key, request, outcome }) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', 'yes');
      localStorage.setItem(key, JSON.stringify({ body: JSON.stringify(request), managementSecret: request.managementSecret,
        deadline: Date.now() + (outcome === 'expired' ? -1000 : 60_000), title: 'Interrupted design',
        ...(outcome === 'expired' ? {} : { terminalError: outcome }) }));
    }, { key: storageKey, request: fixture, outcome });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Recover an interrupted shared link' })).toHaveCount(0);
    await page.goto('/recover-sharing');
    await expect(page.getByRole('heading', { name: 'Interrupted design' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recover link', exact: true })).toHaveCount(0);
    await expect(page.getByText(/check your connection|try again/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Dismiss saved request' }).click();
    await expect(page.getByText('There are no interrupted uploads in this browser.')).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
    expect(uploads).toBe(0);
  });
}

test('a recoverable operation remains discoverable after reload', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ key, request }) => {
    localStorage.setItem(key, JSON.stringify({ body: JSON.stringify(request), managementSecret: request.managementSecret,
      deadline: Date.now() + 60_000, title: 'Interrupted design' }));
  }, { key: storageKey, request: fixture });
  await page.reload();
  await page.getByRole('link', { name: 'Recover an interrupted shared link' }).click();
  await expect(page.getByRole('button', { name: 'Recover link', exact: true })).toBeVisible();
  for (const width of [1600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `tmp/recovery-${width}.png`, fullPage: true });
  }
});
