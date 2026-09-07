// Run with playwright-cli run-code --filename=scripts/check-auth-ui.cjs.
// Google is not contacted. Session UI states are mocked; logout uses the real API.
(async (page) => {
  const origin = 'http://localhost:3000';
  const pageErrors = [];
  const consoleErrors = [];
  let expectedFailure = false;
  const onPageError = (error) => pageErrors.push(error.message);
  const onConsole = (message) => {
    if (message.type() === 'error' && !expectedFailure) consoleErrors.push(message.text());
  };
  page.on('pageerror', onPageError);
  page.on('console', onConsole);
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const session = '**/api/auth/session';

  try {
    for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.emulateMedia({ colorScheme: viewport.width === 390 ? 'dark' : 'light', reducedMotion: 'reduce' });
      await page.goto(origin);
      await page.getByText('로그인 서비스를 준비 중이에요.', { exact: false }).waitFor();
      assert(await page.getByRole('button', { name: 'Google로 로그인' }).isDisabled(), 'Unconfigured login must be disabled');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal overflow');
      await page.screenshot({ path: `_workspace/auth-${viewport.width}.png`, fullPage: true });

      await page.route(session, (route) => route.fulfill({ json: { user: null, googleAvailable: true } }));
      await page.goto(`${origin}/?auth=failed`);
      await page.getByText('로그인을 완료하지 못했어요.', { exact: false }).waitFor();
      const login = page.getByRole('link', { name: 'Google로 로그인' });
      assert(await login.getAttribute('href') === '/api/auth/google', 'Login must use same-origin API');
      await page.keyboard.press('Tab');
      assert(await page.getByRole('link', { name: '본문으로 건너뛰기' }).evaluate((element) => element === document.activeElement), 'Skip link must be keyboard accessible');
      await page.keyboard.press('Tab');
      assert(await login.evaluate((element) => element === document.activeElement), 'Login must be keyboard accessible');
      await login.click();
      await page.waitForURL(`${origin}/?auth=unavailable`);
      await page.unroute(session);

      expectedFailure = true;
      await page.route(session, (route) => route.abort('connectionrefused'));
      await page.goto(origin);
      await page.getByRole('button', { name: '다시 시도' }).waitFor();
      await page.unroute(session);
      await page.getByRole('button', { name: '다시 시도' }).click();
      await page.getByText('로그인 서비스를 준비 중이에요.', { exact: false }).waitFor();
      expectedFailure = false;

      let signedIn = true;
      await page.route(session, (route) => route.fulfill({ json: {
        user: signedIn ? { id: 'ui-fixture', email: 'long-viewer-name-for-mobile@example.test', role: 'USER' } : null,
        googleAvailable: false,
      } }));
      await page.goto(origin);
      await page.getByRole('button', { name: '로그아웃' }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Signed-in content overflows');
      signedIn = false;
      const logoutResponse = page.waitForResponse((response) => response.url() === `${origin}/api/auth/logout` && response.request().method() === 'POST');
      await page.getByRole('button', { name: '로그아웃' }).click();
      const response = await logoutResponse;
      assert(response.status() === 303, 'Real same-origin logout failed');
      assert(response.request().headers().origin === origin, 'Logout must send Origin');
      assert((await response.allHeaders())['set-cookie'].includes('reelink_session='), 'Logout must clear the session cookie');
      await page.getByText('로그인 서비스를 준비 중이에요.', { exact: false }).waitFor();
      await page.unroute(session);
      results.push({ viewport, states: ['unconfigured', 'login-error', 'keyboard', 'retry', 'signed-in', 'real-logout'], passed: true });
    }
    assert(pageErrors.length === 0, `Runtime errors: ${pageErrors.join('; ')}`);
    assert(consoleErrors.length === 0, `Unexpected console errors: ${consoleErrors.join('; ')}`);
    return { results, pageErrors, consoleErrors, note: 'Google credentials absent; session UI mocked, logout API real' };
  } finally {
    await page.unroute(session);
    page.off('pageerror', onPageError);
    page.off('console', onConsole);
  }
})
