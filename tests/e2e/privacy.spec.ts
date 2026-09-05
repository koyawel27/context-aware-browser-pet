import type {
  BrowserContext,
  Page,
  Route
} from '@playwright/test';

import {
  test,
  expect
} from './fixtures';

const BASE =
  'http://localhost:5173';

const NORMAL_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Arcrawls Normal Fixture</title>
</head>
<body>
  <main>
    <h1 id="fixture-kind">normal</h1>
    <p>This page has no sensitive fields.</p>
  </main>
</body>
</html>
`;

const PASSWORD_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Arcrawls Password Fixture</title>
</head>
<body>
  <main>
    <h1 id="fixture-kind">password</h1>

    <form>
      <label>
        Password
        <input
          id="fixture-password"
          name="password"
          type="password"
          autocomplete="current-password"
        >
      </label>
    </form>
  </main>
</body>
</html>
`;

async function installFixtureRouter(
  page: Page
): Promise<void> {
  await page.route(
    `${BASE}/**`,
    async (route: Route) => {
      const requestUrl =
        new URL(route.request().url());

      let body = NORMAL_HTML;

      if (
        requestUrl.pathname === '/password'
      ) {
        body = PASSWORD_HTML;
      }

      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body
      });
    }
  );
}

async function acceptConsent(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  const extensionPage =
    await context.newPage();

  try {
    await extensionPage.goto(
      `chrome-extension://${extensionId}/popup/popup.html`
    );

    await extensionPage.evaluate(
      async () => {
        await chrome.storage.local.set({
          consentAccepted: true
        });

        const stored =
          await chrome.storage.local.get(
            'consentAccepted'
          );

        const storedConsent = (
          stored as Record<string, unknown>
        )['consentAccepted'];

        if (storedConsent !== true) {
          throw new Error(
            'Privacy consent write did not persist; ' +
              `storedConsent=${String(storedConsent)}`
          );
        }
      }
    );
  } finally {
    await extensionPage.close();
  }
}

function petHost(page: Page) {
  return page.locator(
    '#arcrawls-companion-host'
  );
}

function privacyHost(page: Page) {
  return page.locator(
    '#arcrawls-privacy-companion-host'
  );
}

async function expectNormalRuntime(
  page: Page
): Promise<void> {
  await expect(
    petHost(page)
  ).toBeAttached({
    timeout: 15_000
  });

  await expect(
    petHost(page)
  ).toHaveCount(1);
}

async function expectProtectedRuntime(
  page: Page
): Promise<void> {
  await expect(
    petHost(page)
  ).toHaveCount(0);

  // Catch accidentally delayed initialization.
  await page.waitForTimeout(2_000);

  await expect(
    petHost(page)
  ).toHaveCount(0);
}

async function expectPrivacyReaction(
  page: Page
): Promise<void> {
  await expect(
    privacyHost(page)
  ).toHaveCount(
    1,
    {
      timeout: 10_000
    }
  );

  await expect(
    privacyHost(page)
  ).toHaveAttribute(
    'aria-label',
    "I'm paused for this page."
  );

  // One-shot: the host must remove itself shortly after
  // the ~3s going-away animation finishes.
  await expect(
    privacyHost(page)
  ).toHaveCount(
    0,
    {
      timeout: 10_000
    }
  );
}

async function expectNoPrivacyReaction(
  page: Page
): Promise<void> {
  await expect(
    privacyHost(page)
  ).toHaveCount(0);

  await page.waitForTimeout(1_000);

  await expect(
    privacyHost(page)
  ).toHaveCount(0);
}

async function setBlockedDomains(
  context: BrowserContext,
  extensionId: string,
  domains: string[]
): Promise<void> {
  // Install-default readiness is guaranteed by the extensionId
  // fixture. This helper only writes blockedDomains and verifies
  // the write persisted.
  const writerPage =
    await context.newPage();

  try {
    await writerPage.goto(
      `chrome-extension://${extensionId}/popup/popup.html`
    );

    await writerPage.evaluate(
      async (list: string[]) => {
        const cur =
          await chrome.storage.local.get(
            'pet-settings'
          ) as Record<string, any>;

        await chrome.storage.local.set({
          'pet-settings': {
            ...(cur['pet-settings'] || {}),
            blockedDomains: list
          }
        });
      },
      domains
    );

    const deadline = Date.now() + 10_000;

    for (;;) {
      const after =
        await writerPage.evaluate(
          async () => {
            const stored =
              await chrome.storage.local.get(
                'pet-settings'
              ) as Record<string, any>;

            return (stored['pet-settings'] || {}) as Record<string, any>;
          }
        );

      if (
        JSON.stringify(after.blockedDomains) ===
          JSON.stringify(domains)
      ) {
        return;
      }

      if (Date.now() > deadline) {
        throw new Error(
          `blockedDomains write did not persist: ${JSON.stringify(domains)}`
        );
      }

      await writerPage.waitForTimeout(100);
    }
  } finally {
    await writerPage.close();
  }
}

test.describe(
  'Arcrawls sensitive-page privacy boundary',
  () => {

    test(
      'runs normally on a non-sensitive page',
      async ({
        page,
        context,
        extensionId
      }) => {
        await installFixtureRouter(page);

        await acceptConsent(
          context,
          extensionId
        );

        await page.goto(
          `${BASE}/normal`,
          {
            waitUntil:
              'domcontentloaded'
          }
        );

        await expect(
          page.locator('#fixture-kind')
        ).toHaveText('normal');

        expect(
          new URL(page.url()).pathname
        ).toBe('/normal');

        await expectNormalRuntime(page);

        await expectNoPrivacyReaction(page);
      }
    );

    test(
      'does not start on a sensitive login route',
      async ({
        page,
        context,
        extensionId
      }) => {
        await installFixtureRouter(page);

        await acceptConsent(
          context,
          extensionId
        );

        await page.goto(
          `${BASE}/login`,
          {
            waitUntil:
              'domcontentloaded'
          }
        );

        // The router deliberately serves normal HTML.
        // Only the URL should make this protected.
        await expect(
          page.locator('#fixture-kind')
        ).toHaveText('normal');

        expect(
          new URL(page.url()).pathname
        ).toBe('/login');

        await expectPrivacyReaction(page);

        await expectProtectedRuntime(page);
      }
    );

    test(
      'does not start when a password field exists',
      async ({
        page,
        context,
        extensionId
      }) => {
        await installFixtureRouter(page);

        await acceptConsent(
          context,
          extensionId
        );

        await page.goto(
          `${BASE}/password`,
          {
            waitUntil:
              'domcontentloaded'
          }
        );

        await expect(
          page.locator('#fixture-kind')
        ).toHaveText('password');

        const password =
          page.locator(
            '#fixture-password'
          );

        await expect(
          password
        ).toHaveCount(1);

        await expect(
          password
        ).toHaveAttribute(
          'type',
          'password'
        );

        await expect(
          password
        ).toHaveAttribute(
          'autocomplete',
          'current-password'
        );

        await expectPrivacyReaction(page);

        await expectProtectedRuntime(page);
      }
    );

    test(
      'locks permanently when a password field appears dynamically',
      async ({
        page,
        context,
        extensionId
      }) => {
        await installFixtureRouter(page);

        await acceptConsent(
          context,
          extensionId
        );

        await page.goto(
          `${BASE}/normal`,
          {
            waitUntil:
              'domcontentloaded'
          }
        );

        await expectNormalRuntime(page);

        await page.evaluate(() => {
          const input =
            document.createElement(
              'input'
            );

          input.id =
            'dynamic-password';

          input.name =
            'password';

          input.type =
            'password';

          input.autocomplete =
            'current-password';

          document.body.appendChild(
            input
          );
        });

        await expect(
          page.locator(
            '#dynamic-password'
          )
        ).toHaveCount(1);

        await expect(
          petHost(page)
        ).toHaveCount(
          0,
          {
            timeout: 10_000
          }
        );

        // The reaction appears once, after teardown, then self-removes.
        await expectPrivacyReaction(page);

        // Removing the field must NOT restart
        // an already privacy-locked document.
        await page.evaluate(() => {
          document
            .querySelector(
              '#dynamic-password'
            )
            ?.remove();
        });

        await page.waitForTimeout(1_000);

        await expect(
          petHost(page)
        ).toHaveCount(0);

        // The one-shot reaction must not recreate
        // after it self-removed.
        await expectNoPrivacyReaction(page);
      }
    );

    test(
      'locks on SPA checkout navigation, stays locked on SPA return, and restores after reload',
      async ({
        page,
        context,
        extensionId
      }) => {
        await installFixtureRouter(page);

        await acceptConsent(
          context,
          extensionId
        );

        await page.goto(
          `${BASE}/normal`,
          {
            waitUntil:
              'domcontentloaded'
          }
        );

        await expectNormalRuntime(page);

        await page.evaluate(() => {
          history.pushState(
            {},
            '',
            '/checkout'
          );
        });

        await expect.poll(
          () => page.evaluate(
            () => location.pathname
          )
        ).toBe('/checkout');

        await expect(
          petHost(page)
        ).toHaveCount(
          0,
          {
            timeout: 10_000
          }
        );

        // The locked document shows the one-shot reaction once.
        await expectPrivacyReaction(page);

        // Going back to a safe SPA route inside
        // the same document must stay locked.
        await page.evaluate(() => {
          history.pushState(
            {},
            '',
            '/normal'
          );
        });

        await expect.poll(
          () => page.evaluate(
            () => location.pathname
          )
        ).toBe('/normal');

        await page.waitForTimeout(1_000);

        await expect(
          petHost(page)
        ).toHaveCount(0);

        // The reaction must not replay on SPA navigation.
        await expectNoPrivacyReaction(page);

        // A real reload creates a fresh document.
        await page.reload({
          waitUntil:
            'domcontentloaded'
        });

        await expect(
          page.locator('#fixture-kind')
        ).toHaveText('normal');

        await expectNormalRuntime(page);

        await expectNoPrivacyReaction(page);
      }
    );

    test(
      'initially protected page initializes normally after safe SPA navigation',
      async ({
        page,
        context,
        extensionId
      }) => {
        await installFixtureRouter(page);

        await acceptConsent(
          context,
          extensionId
        );

        await page.goto(
          `${BASE}/login`,
          {
            waitUntil:
              'domcontentloaded'
          }
        );

        expect(
          new URL(page.url()).pathname
        ).toBe('/login');

        // This document was never locked because the normal
        // runtime never existed. Do not chase the transient
        // ~3.5s reaction window here; the dedicated login test
        // already covers reaction show-once/self-remove.
        await expect(
          petHost(page)
        ).toHaveCount(0);

        await page.evaluate(() => {
          history.pushState(
            {},
            '',
            '/normal'
          );
        });

        await expect.poll(
          () => page.evaluate(
            () => location.pathname
          )
        ).toBe('/normal');

        // The stale reaction is removed and normal runtime starts.
        await expectNormalRuntime(page);

        await expectNoPrivacyReaction(page);
      }
    );

    test(
      'shows neither mascot nor reaction before privacy consent',
      async ({
        page
      }) => {
        await installFixtureRouter(page);

        await page.goto(
          `${BASE}/login`,
          {
            waitUntil:
              'domcontentloaded'
          }
        );

        expect(
          new URL(page.url()).pathname
        ).toBe('/login');

        await page.waitForTimeout(2_000);

        await expect(
          petHost(page)
        ).toHaveCount(0);

        await expect(
          privacyHost(page)
        ).toHaveCount(0);
      }
    );

    test(
      'user-blocked domain shows neither mascot nor reaction',
      async ({
        page,
        context,
        extensionId
      }) => {
        await installFixtureRouter(page);

        await acceptConsent(
          context,
          extensionId
        );

        await setBlockedDomains(
          context,
          extensionId,
          ['localhost']
        );

        await page.goto(
          `${BASE}/normal`,
          {
            waitUntil:
              'domcontentloaded'
          }
        );

        await expect(
          page.locator('#fixture-kind')
        ).toHaveText('normal');

        await page.waitForTimeout(2_000);

        await expect(
          petHost(page)
        ).toHaveCount(0);

        await expectNoPrivacyReaction(page);
      }
    );

    test(
      'user-block during a locked document removes the live reaction',
      async ({
        page,
        context,
        extensionId
      }) => {
        await installFixtureRouter(page);

        await acceptConsent(
          context,
          extensionId
        );

        // Open the settings writer BEFORE triggering the sensitive
        // condition, so no popup navigation occurs during the
        // 3.5s privacy-reaction window.
        const writerPage =
          await context.newPage();

        try {
          await writerPage.goto(
            `chrome-extension://${extensionId}/popup/popup.html`
          );

          await page.goto(
            `${BASE}/normal`,
            {
              waitUntil:
                'domcontentloaded'
            }
          );

          await expectNormalRuntime(page);

          await page.evaluate(() => {
            const input =
              document.createElement(
                'input'
              );

            input.id =
              'lock-trigger-password';

            input.name =
              'password';

            input.type =
              'password';

            input.autocomplete =
              'current-password';

            document.body.appendChild(
              input
            );
          });

          // Lock engaged: normal runtime torn down.
          await expect(
            petHost(page)
          ).toHaveCount(
            0,
            {
              timeout: 10_000
            }
          );

          // The lock reaction must be on screen now.
          await expect(
            privacyHost(page)
          ).toHaveCount(
            1,
            {
              timeout: 10_000
            }
          );

          // User-block the current domain while the reaction is
          // live, using the already-open writer page.
          await writerPage.evaluate(
            async () => {
              const cur =
                await chrome.storage.local.get(
                  'pet-settings'
                ) as Record<string, any>;

              await chrome.storage.local.set({
                'pet-settings': {
                  ...(cur['pet-settings'] || {}),
                  blockedDomains: ['localhost']
                }
              });
            }
          );

          // Removal must be prompt: well inside the normal 3500ms
          // lifetime, proving the block transition caused it.
          await expect(
            privacyHost(page)
          ).toHaveCount(
            0,
            {
              timeout: 2_000
            }
          );

          await expect(
            petHost(page)
          ).toHaveCount(0);

          // The document stays permanently locked: removing the
          // sensitive field must NOT restart normal runtime.
          await page.evaluate(() => {
            document
              .querySelector(
                '#lock-trigger-password'
              )
              ?.remove();
          });

          await page.waitForTimeout(1_000);

          await expect(
            petHost(page)
          ).toHaveCount(0);
        } finally {
          await writerPage.close();
        }
      }
    );
  }
);