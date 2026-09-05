import { test as base, chromium, type BrowserContext } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Extension e2e fixtures.
 *
 * Loading a real Chrome extension requires `launchPersistentContext` (not the
 * default ephemeral browser). That path is flaky under parallel workers and can
 * hang on close — so we use a unique temp profile, a dedicated fixture timeout,
 * and a bounded fail-loud teardown.
 */

const GRACEFUL_CONTEXT_CLOSE_TIMEOUT_MS = 10_000;
const FORCE_BROWSER_CLOSE_TIMEOUT_MS = 10_000;
export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // Own timeout so launch doesn't burn the whole test budget.
  context: [async ({}, use) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const pathToExtension = path.resolve(__dirname, '../../dist');

    if (!fs.existsSync(path.join(pathToExtension, 'manifest.json'))) {
      throw new Error(
        `Extension build not found at ${pathToExtension}. Run "npm run build" before e2e tests.`,
      );
    }

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcrawls-pw-'));

    let context: BrowserContext | undefined;
    let browser:
      | ReturnType<BrowserContext['browser']>
      | undefined;
    try {
      context = await chromium.launchPersistentContext(userDataDir, {
        // MV3 content scripts need a real browser window in most Chromium builds.
        headless: false,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-sync',
          '--disable-background-networking',
        ],
        ignoreDefaultArgs: ['--disable-extensions'],
        timeout: 45_000,
      });

      browser = context.browser();

      if (!browser) {
        throw new Error(
          'Extension test fixture has no owning browser for the persistent context.'
        );
      }

      await use(context);
    } finally {
      // Two-stage shutdown: graceful context.close() first, then a
      // bounded browser.close() recovery if graceful close rejects
      // or times out. A recovered timeout warns but does not fail
      // the product test; an unrecoverable shutdown does.
      // Outcome priority on failure:
      // 1. inability to force-close the browser
      // 2. inability to remove the profile
      // 3. graceful-close trouble, diagnostic context only.
      let gracefulDiagnostic: string | undefined;

      if (context) {
        let closeTimer:
          | ReturnType<typeof setTimeout>
          | undefined;

        // Attach the catch handler up front so a late rejection
        // after a timeout win cannot become unhandled.
        const closeOutcome = context
          .close()
          .then(
            (): string | undefined => undefined,
            (err): string | undefined =>
              `graceful context close rejected: ${err instanceof Error ? err.message : String(err)}`
          );

        const closeTimeout =
          new Promise<string>((resolve) => {
            closeTimer = setTimeout(
              () => {
                resolve('graceful context close timed out');
              },
              GRACEFUL_CONTEXT_CLOSE_TIMEOUT_MS
            );
          });

        try {
          gracefulDiagnostic = await Promise.race([
            closeOutcome,
            closeTimeout
          ]);
        } finally {
          if (closeTimer !== undefined) {
            clearTimeout(closeTimer);
          }
        }

        if (gracefulDiagnostic !== undefined) {
          if (!browser) {
            throw new Error(
              `Extension teardown cannot recover: ${gracefulDiagnostic}; no owning browser is available.`
            );
          }

          let forceTimer:
            | ReturnType<typeof setTimeout>
            | undefined;

          try {
            const forceClose = browser.close();

            const forceTimeout =
              new Promise<never>((_, reject) => {
                forceTimer = setTimeout(
                  () => {
                    reject(
                      new Error(
                        `Extension browser force-close did not finish within ${FORCE_BROWSER_CLOSE_TIMEOUT_MS}ms`
                      )
                    );
                  },
                  FORCE_BROWSER_CLOSE_TIMEOUT_MS
                );
              });

            await Promise.race([
              forceClose,
              forceTimeout
            ]);
          } catch (err) {
            throw new Error(
              `Extension teardown failed to force-close the browser after ${gracefulDiagnostic}; ` +
                `force-close error: ${err instanceof Error ? err.message : String(err)}`
            );
          } finally {
            if (forceTimer !== undefined) {
              clearTimeout(forceTimer);
            }
          }

          if (
            typeof browser.isConnected === 'function' &&
            browser.isConnected()
          ) {
            throw new Error(
              `Extension teardown failed: browser remains connected after force-close (${gracefulDiagnostic}).`
            );
          }

          console.warn(
            `[Arcrawls E2E] Persistent-context teardown needed forced browser shutdown (${gracefulDiagnostic}); ` +
              'shutdown succeeded.'
          );
        }
      }

      let cleanupError: unknown;

      try {
        fs.rmSync(userDataDir, {
          recursive: true,
          force: true,
          maxRetries: 10,
          retryDelay: 500
        });
      } catch (err) {
        cleanupError = err;
      }

      if (fs.existsSync(userDataDir)) {
        throw (
          cleanupError ??
          new Error(
            `Extension test profile was not removed: ${userDataDir}`
          )
        );
      }
    }
  }, { scope: 'test', timeout: 60_000 }],

  extensionId: [async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 20_000 });
    }

    const extensionId = background.url().split('/')[2];
    if (!extensionId) {
      throw new Error(`Could not parse extension id from service worker URL: ${background.url()}`);
    }

    // Centralize install readiness: the worker can exist while the
    // background onInstalled handler is still writing default
    // pet-settings. Every test must see install defaults complete
    // before the fixture yields, so per-test helpers never race it.
    // The deadline starts after page load, so navigation time does
    // not consume the storage-readiness budget.
    const readinessPage = await context.newPage();

    try {
      await readinessPage.goto(
        `chrome-extension://${extensionId}/popup/popup.html`
      );

      const INSTALL_READINESS_TIMEOUT_MS = 30_000;
      const INSTALL_READINESS_POLL_MS = 100;
      const readinessDeadline =
        Date.now() + INSTALL_READINESS_TIMEOUT_MS;

      for (;;) {
        const ready = await readinessPage.evaluate(
          async () => {
            const stored =
              await chrome.storage.local.get(
                'pet-settings'
              ) as Record<string, any>;

            return (
              (stored['pet-settings'] || {}).name !==
              undefined
            );
          }
        );

        if (ready) break;

        if (Date.now() > readinessDeadline) {
          throw new Error(
            'Extension install defaults did not become ready within 30000ms; pet-settings.name is missing.'
          );
        }

        await readinessPage.waitForTimeout(
          INSTALL_READINESS_POLL_MS
        );
      }
    } finally {
      await readinessPage.close();
    }

    await use(extensionId);
  }, { scope: 'test', timeout: 60_000 }],
});

export const expect = test.expect;
