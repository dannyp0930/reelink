// pnpm dlx @playwright/cli -s=c2 --raw run-code --filename=scripts/check-movie-metadata.cjs
// Isolated UI fixtures: no account changes or personal DB writes.
(async hostPage => {
  const context = await hostPage.context().browser().newContext({ hasTouch: true });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('dialog', dialog => dialog.accept());
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  let expectedFailure = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !(expectedFailure && /Failed to load resource: the server responded with a status of (401|503)/.test(message.text()))) errors.push(message.text());
  });
  const origin = 'http://localhost:3002';
  const cinema = { id: 'cinema-1', name: '테스트 극장', address: '서울특별시 테스트로 123', status: 'TEMPORARILY_CLOSED' };
  let movie = { id: 'movie-1', title: '기생충', releaseDate: '2019-05-30T00:00:00.000Z', runtimeMinutes: 132, posterUrl: 'https://image.tmdb.org/t/p/w154/fixture.jpg' };
  let records = [], writes = [], queries = [], cinemaStatus = 200, releaseSlow;
  await page.route('https://image.tmdb.org/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90"><rect width="60" height="90" fill="#165f45"/></svg>' }));
  await page.route('**/api/**', async route => {
    const rawUrl = route.request().url();
    const url = { pathname: rawUrl.slice(origin.length).split('?')[0] };
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { user: { id: 'fixture', email: 'viewer@example.test', role: 'USER' }, googleAvailable: true } });
    if (url.pathname === '/api/movies/search') return route.fulfill({ json: { page: 1, totalPages: 1, results: [{ tmdbId: 496243, title: movie.title, releaseDate: '2019-05-30', posterUrl: null }] } });
    if (url.pathname === '/api/movies/tmdb/496243') return route.fulfill({ json: movie });
    if (url.pathname === '/api/cinemas') {
      const q = decodeURIComponent(rawUrl.match(/[?&]q=([^&]*)/)?.[1] ?? ''); queries.push(q);
      if (q === '느림') await new Promise(resolve => { releaseSlow = resolve; });
      return route.fulfill({ status: cinemaStatus, json: cinemaStatus !== 200 ? {} : q === '없음' ? [] : [q === '느림' ? { ...cinema, id: 'old', name: '늦은 결과' } : cinema] }).catch(() => {});
    }
    if (url.pathname === '/api/viewings' && route.request().method() === 'POST') {
      const data = route.request().postDataJSON(); writes.push(data);
      const row = { ...data, id: 'record-' + writes.length, watchedOn: data.watchedOn + 'T00:00:00.000Z', ratingHalfStars: null, movie, cinema: data.cinemaId ? cinema : null };
      records.unshift(row);
      return route.fulfill({ status: 201, json: row });
    }
    if (url.pathname.startsWith('/api/viewings/')) return route.fulfill({json:records.find(row => row.id === url.pathname.split('/').pop())});
    if (url.pathname === '/api/viewings') return route.fulfill({ json: { items: records, page: 1, limit: 50, totalItems: records.length, totalPages: Math.ceil(records.length / 50) } });
    return route.abort();
  });
  const results = [];
  try {
    for (const width of [1280, 390]) {
      records = []; writes = []; queries = []; cinemaStatus = 200;
      movie = { ...movie, releaseDate: '2019-05-30T00:00:00.000Z', runtimeMinutes: 132, posterUrl: 'https://image.tmdb.org/t/p/w154/fixture.jpg' };
      await page.setViewportSize({ width, height: 844 });
      await page.emulateMedia({ colorScheme: width === 390 ? 'dark' : 'light' });
      await page.goto(origin + '/viewings/new');
      await page.getByLabel('영화 제목').fill('기생충');
      await page.getByRole('button', { name: '기생충 선택' }).click();
      const selectedMovie = page.locator('main');
      await selectedMovie.getByText('2019년 · 132분').waitFor();
      const poster = selectedMovie.getByRole('img', { name: '기생충 포스터' });
      await poster.waitFor();
      await page.waitForFunction(() => document.querySelector('main img')?.naturalWidth > 0);
      await page.getByRole('button', {name:'극장',exact:true}).click();
      const search = page.getByRole('combobox', {name:'극장',exact:true});
      const choices = page.getByRole('combobox', { name: '극장', exact: true });
      await choices.fill('테스트');
      await page.getByRole('option', {name:/테스트 극장/}).click();
      await page.getByLabel('관람 날짜').fill('2024-02-29');
      await page.getByLabel('메모').fill('초안 유지');
      queries = [];
      await search.fill('테'); await search.fill('테스'); await search.fill('테스트');
      await page.getByRole('option', { name: /테스트 극장/ }).waitFor({ state: 'attached' });
      await page.waitForFunction(() => !document.querySelector('form [role="status"]')?.textContent.includes('검색 중'));
      assert(queries.length === 1 && queries[0] === '테스트', 'Cinema search must debounce');
      assert(await search.evaluate(el => el === document.activeElement), 'Search must preserve focus');
      await search.press('Enter'); assert(writes.length === 0, 'Cinema Enter must not save the viewing');
      await search.fill('없음');
      await page.getByText('검색 결과가 없어요.', { exact: false }).waitFor();
      assert(await page.getByRole('button', {name:'극장 선택 해제'}).isVisible(), 'Empty results cleared selected cinema');
      await search.fill('느림');
      await page.waitForRequest(request => request.url().includes(encodeURIComponent('느림')));
      await search.fill('테스트');
      await page.waitForResponse(response => response.url().includes('/api/cinemas?q=' + encodeURIComponent('테스트')));
      releaseSlow?.(); releaseSlow = undefined;
      await search.fill('');
      await page.waitForResponse(response => response.url().endsWith('/api/cinemas?q='));
      assert(await page.getByRole('option', { name: '늦은 결과', exact: true }).count() === 0, 'Stale search result replaced current results');
      expectedFailure = true; cinemaStatus = 503;
      await search.fill('실패');
      await page.getByText('극장 검색 실패.', { exact: false }).waitFor();
      assert(await page.getByRole('button', {name:'극장 선택 해제'}).isVisible(), 'Failed search cleared selection');
      cinemaStatus = 200;
      await search.fill('재시도');
      await page.getByRole('option', {name:/테스트 극장/}).waitFor();
      await page.waitForFunction(() => !document.querySelector('form [role="status"]')?.textContent.includes('검색 중'));
      expectedFailure = false;
      assert(await page.getByLabel('메모').inputValue() === '초안 유지', 'Cinema search lost draft');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      await selectedMovie.scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: '관람 기록 저장', exact: true }).click();
      await page.getByRole('heading', {name:'관람 기록', exact:true}).waitFor();
      assert(writes[0].cinemaId === cinema.id && !('cinemaQuery' in writes[0]), 'Wrong cinema payload');
      await page.reload();
      await page.locator('main').getByText('2019년 · 132분').waitFor();
      await page.locator('main').getByText('테스트 극장 (휴업)', {exact:false}).waitFor();
      movie = { ...movie, releaseDate: null, runtimeMinutes: null, posterUrl: null };
      await page.goto(origin + '/viewings/new');
      await page.getByLabel('영화 제목').fill('기생충');
      await page.getByRole('button', { name: '기생충 선택' }).click();
      await selectedMovie.getByText('개봉연도 미상 · 러닝타임 미상').waitFor();
      await selectedMovie.getByText('포스터 없음').waitFor();
      await page.getByLabel('관람 날짜').fill('2024-03-01');
      await page.getByRole('button', { name: '관람 기록 저장', exact: true }).click();
      await page.getByRole('heading', {name:'관람 기록', exact:true}).waitFor();
      assert(writes[1].cinemaId === null, 'New form must clear cinema selection');
      results.push({ width, passed: true });
    }
    assert(errors.length === 0, errors.join('; '));
    return { results, errors, note: 'API/image fixtures; no personal DB writes' };
  } catch (error) {
    throw new Error(error.message + '\nfixture writes=' + JSON.stringify(writes) + '\nurl=' + page.url() + '\n' + await page.locator('main').innerText());
  } finally {
    releaseSlow?.();
    await context.close();
  }
})
