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
      }
    );

    // Let the background consent listener apply
    // its monitoring state before navigation.
    await extensionPage.waitForTimeout(300);
  } finally {
    await extensionPage.close();
  }
}

function petHost(page: Page) {
  return page.locator(
    '#arcrawls-companion-host'
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

        // A real reload creates a fresh document.
        await page.reload({
          waitUntil:
            'domcontentloaded'
        });

        await expect(
          page.locator('#fixture-kind')
        ).toHaveText('normal');

        await expectNormalRuntime(page);
      }
    );
  }
);