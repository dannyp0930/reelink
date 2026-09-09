// Run: pnpm dlx @playwright/cli -s=viewing run-code --filename=scripts/check-viewing-ui.cjs
// Isolated UI contract checks. API responses mocked; no Google account or personal DB writes.
(async (page) => {
  const origin = 'http://localhost:3002';
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const errors = [];
  let expectedFailure = false;
  const onError = error => errors.push(error.message);
  const onConsole = message => { if (message.type() === 'error' && !expectedFailure) errors.push(message.text()); };
  page.on('pageerror', onError);
  page.on('console', onConsole);
  const movie = { id: '11111111-1111-4111-8111-111111111111', title: '기생충', originalTitle: '기생충', releaseDate: '2019-05-30T00:00:00.000Z' };
  let writes = [];
  let records = [];
  let saveStatus = 201;
  let searchStatus = 200;
  let cinemaFailure = false;
  let loggedIn = true;
  await page.route('**/api/**', async route => {
    const rawUrl = route.request().url();
    const url = {pathname: rawUrl.slice(origin.length).split('?')[0]};
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { user: loggedIn ? {id: 'fixture', email:'viewer@example.test', role:'USER'} : null, googleAvailable: true } });
    if (url.pathname === '/api/cinemas') return route.fulfill({ status: cinemaFailure ? 503 : 200, json: cinemaFailure ? {} : [{id:'22222222-2222-4222-8222-222222222222', name:'테스트 극장', chain:'INDEPENDENT', status:'CLOSED'}] });
    if (url.pathname === '/api/movies/search') return route.fulfill({ status: searchStatus, json: { page:Number(rawUrl.match(/[?&]page=(\d+)/)?.[1] || 1), totalPages:2, results: decodeURIComponent(rawUrl).includes('q=없음') ? [] : [{tmdbId:496243, title:'기생충', originalTitle:'기생충', releaseDate:'2019-05-30'}] } });
    if (url.pathname === '/api/movies/tmdb/496243') return route.fulfill({ json: movie });
    if (url.pathname === '/api/viewings' && route.request().method() === 'POST') {
      const data = route.request().postDataJSON();
      writes.push(data);
      if (saveStatus !== 201) return route.fulfill({status:saveStatus, json:{}});
      const record = {id:'record-' + writes.length, ...data, watchedOn:data.watchedOn+'T00:00:00.000Z', movie, ratingHalfStars:data.rating === null ? null : data.rating * 2};
      records.unshift(record);
      return route.fulfill({status:201, json:record});
    }
    if (url.pathname === '/api/viewings') return route.fulfill({json:records});
    return route.abort();
  });
  const results = [];
  try {
    for (const width of [1280, 390]) {
      writes = []; records = []; saveStatus = 201; searchStatus = 200;
      await page.setViewportSize({width, height:844});
      await page.emulateMedia({colorScheme:width === 390 ? 'dark' : 'light', reducedMotion:'reduce'});
      await page.goto(origin);
      await page.getByRole('heading', {name:'관람 기록 남기기'}).waitFor({timeout:10000});
      await page.getByLabel('영화 제목').fill('없음');
      await page.getByLabel('영화 제목').press('Enter');
      await page.getByText('검색 결과가 없어요. 다른 제목으로 검색해 주세요.').waitFor();
      await page.getByLabel('영화 제목').fill('기생충');
      await page.getByLabel('영화 제목').press('Enter');
      await page.getByRole('button', {name:'다음 검색 결과'}).click();
      await page.getByText('2 / 2 페이지').waitFor();
      await page.getByRole('button', {name:'기생충 선택'}).click();
      await page.getByLabel('관람 날짜').fill('2024-02-29');
      await page.getByLabel('내 평점').selectOption('4.5');
      await page.getByLabel('극장', {exact:true}).selectOption('22222222-2222-4222-8222-222222222222');
      await page.getByLabel('상영관').fill('1관');
      await page.getByLabel('메모').fill('다시 봐도 좋았다');
      expectedFailure = true; saveStatus = 400;
      await page.getByRole('button', {name:'관람 기록 저장', exact:true}).click();
      await page.getByRole('alert').filter({hasText:'입력값'}).waitFor();
      assert(await page.getByLabel('메모').inputValue() === '다시 봐도 좋았다', 'Failed write lost draft');
      saveStatus = 201;
      await page.getByRole('button', {name:'관람 기록 저장', exact:true}).click();
      await page.getByText('관람 기록을 저장했어요.', {exact:true}).waitFor();
      expectedFailure = false;
      assert(writes.length === 2 && writes[1].rating === 4.5 && writes[1].movieId === movie.id && writes[1].watchedOn === '2024-02-29', 'Wrong create payload');
      assert(writes[1].cinemaId && writes[1].auditorium === '1관', 'Missing cinema/auditorium');
      assert(await page.getByRole('button', {name:'관람 기록 저장', exact:true}).isDisabled(), 'Saved form must prevent duplicate submit');
      await page.reload();
      await page.getByRole('region', {name:'최근 관람 기록'}).getByText('4.5점').waitFor();
      for (const rating of ['0', '5', '']) {
        await page.getByLabel('영화 제목').fill('기생충');
      await page.getByLabel('영화 제목').press('Enter');
        await page.getByRole('button', {name:'기생충 선택'}).click();
        await page.getByLabel('관람 날짜').fill('2024-02-29');
        await page.getByLabel('내 평점').selectOption(rating);
        await page.getByRole('button', {name:'관람 기록 저장', exact:true}).click();
        await page.getByText('관람 기록을 저장했어요.', {exact:true}).waitFor();
        assert(writes.at(-1).rating === (rating === '' ? null : Number(rating)), 'Zero/unrated/full rating confused');
        await page.getByRole('button', {name:'새 관람 기록'}).click();
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      await page.screenshot({path:`_workspace/viewing-${width}.png`, fullPage:true});
      expectedFailure = true; searchStatus = 503;
      await page.getByLabel('영화 제목').fill('기생충');
      await page.getByLabel('영화 제목').press('Enter');
      await page.getByRole('alert').filter({hasText:'검색'}).waitFor();
      searchStatus = 200;
      await page.getByLabel('영화 제목').press('Enter');
      await page.getByRole('button', {name:'기생충 선택'}).click();
      await page.getByLabel('관람 날짜').fill('2024-02-29');
      await page.getByLabel('메모').fill('세션 만료에도 유지');
      saveStatus = 401;
      await page.getByRole('button', {name:'관람 기록 저장', exact:true}).click();
      await page.getByRole('link', {name:'다시 로그인'}).waitFor();
      assert(await page.getByLabel('메모').inputValue() === '세션 만료에도 유지', '401 lost draft');
      // Dismiss a real beforeunload prompt; do not navigate away from a dirty draft.
      let warned = false;
      const dismiss = async dialog => { warned = dialog.type() === 'beforeunload'; await dialog.dismiss(); };
      page.once('dialog', dismiss);
      await page.reload({timeout:3000}).catch(() => {});
      assert(warned, 'Dirty draft needs navigation warning');
      page.once('dialog', dialog => dialog.accept());
      cinemaFailure = true;
      await page.reload();
      await page.getByText('극장 목록을 불러오지 못했어요.', {exact:false}).waitFor();
      cinemaFailure = false;
      await page.getByRole('button', {name:'극장 목록 다시 시도'}).click();
      await page.getByLabel('극장', {exact:true}).getByRole('option', {name:'테스트 극장 (폐업)'}).waitFor({state:'attached'});
      expectedFailure = false;
      results.push({width, passed:true});
    }
    loggedIn = false;
    await page.goto(origin);
    await page.getByRole('link', {name:'Google로 로그인'}).waitFor();
    assert(await page.getByRole('heading', {name:'관람 기록 남기기'}).count() === 0, 'Logged-out form exposed');
    assert(errors.length === 0, errors.join('; '));
    return {results, errors, note:'UI contracts mocked; no personal data created'};
  } finally {
    await page.unroute('**/api/**');
    page.off('pageerror', onError); page.off('console', onConsole);
  }
})
