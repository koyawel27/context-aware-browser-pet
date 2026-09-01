import { test, expect } from './fixtures';

test.describe('Arcrawls Browser Extension E2E', () => {
  test('keeps the pet disabled until explicit consent, then injects it', async ({ page, context, extensionId }) => {
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });

    const petHost = page.locator('#arcrawls-companion-host');
    await expect(petHost).toHaveCount(0);
    await page.waitForTimeout(750);
    await expect(petHost).toHaveCount(0);

    const extensionPage = await context.newPage();
    try {
      await extensionPage.goto(`chrome-extension://${extensionId}/popup/popup.html`);
      await extensionPage.evaluate(async () => {
        await chrome.storage.local.set({ consentAccepted: true });
      });
    } finally {
      await extensionPage.close();
    }

    await expect(petHost).toBeAttached({ timeout: 15_000 });
    await expect(petHost).toHaveCount(1);
  });

  test('extension popup loads successfully', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`);

    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Popup bootstraps async settings/locale; wait for a stable root marker.
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
