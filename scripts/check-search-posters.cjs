// pnpm dlx @playwright/cli -s=posters run-code --filename=scripts/check-search-posters.cjs
// Isolated API/image fixtures. No personal account or database writes.
(async page => {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const origin = 'http://localhost:3002';
  const errors = [];
  const onError = error => errors.push(error.message);
  const onConsole = message => { if (message.type() === 'error') errors.push(message.text()); };
  page.on('pageerror', onError); page.on('console', onConsole);
  const items = Array.from({length:20}, (_, index) => ({
    tmdbId:index + 1, title:index === 0 ? '기생충' : `영화 ${index + 1}`, originalTitle: null,
    releaseDate: index === 2 ? null : '2019-05-30',
    posterUrl: index === 1 ? null : `https://image.tmdb.org/t/p/w154/${index === 2 ? 'broken' : 'poster'}.jpg`,
  }));
  await page.route('https://image.tmdb.org/**', route => route.fulfill({
    contentType: 'image/svg+xml', body: route.request().url().includes('broken') ? 'invalid image' : '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="90"><rect width="60" height="90" fill="#165f45"/></svg>',
  }));
  await page.route('**/api/**', route => {
    const path = route.request().url().slice(origin.length).split('?')[0];
    if (path === '/api/auth/session') return route.fulfill({json:{user:{id:'fixture',email:'viewer@example.test',role:'USER'},googleAvailable:true}});
    if (path === '/api/movies/search') return route.fulfill({json:{page:1,totalPages:1,results:items}});
    if (path.startsWith('/api/movies/tmdb/')) return route.fulfill({json:{id:'fixture-movie',title:'기생충'}});
    if (path === '/api/viewings') return route.fulfill({json:{items:[],page:1,limit:50,totalItems:0,totalPages:0}});
    if (path === '/api/cinemas') return route.fulfill({json:[]});
    return route.abort();
  });
  const results = [];
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({width,height:844});
      await page.emulateMedia({colorScheme: width === 390 ? 'dark' : 'light', reducedMotion:'reduce'});
      await page.goto(origin + '/viewings/new');
      await page.getByLabel('영화 제목').fill('기생충');
      await page.getByLabel('영화 제목').press('Enter');
      const list = page.getByRole('region', {name:'영화 검색 결과'});
      await list.waitFor({timeout:10000});
      assert(await list.evaluate(el => el.scrollHeight > el.clientHeight && el.clientHeight <= innerHeight * 0.6), 'Results need bounded vertical scroll');
      const poster = list.getByRole('img', {name:'기생충 포스터'});
      await poster.waitFor();
      await page.waitForFunction(() => document.querySelector('img[alt="기생충 포스터"]')?.naturalWidth > 0);
      assert(await poster.getAttribute('src') === 'https://image.tmdb.org/t/p/w154/poster.jpg', 'Wrong poster source');
      const missing = list.getByRole('listitem').nth(1);
      await missing.getByText('포스터 없음').waitFor();
      const broken = list.getByRole('listitem').nth(2);
      await broken.scrollIntoViewIfNeeded();
      await broken.getByText('포스터 없음').waitFor();
      await list.focus();
      await page.keyboard.press('End');
      await page.waitForFunction(() => document.querySelector('[aria-label="영화 검색 결과"]').scrollTop > 0);
      await list.getByRole('button', {name:'영화 20 선택'}).focus();
      assert(await list.getByRole('button', {name:'영화 20 선택'}).evaluate(el => {
        const container = el.closest('[role="region"]').getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        return el === document.activeElement && rect.top >= container.top && rect.bottom <= container.bottom;
      }), 'Last result keyboard access');
      await list.evaluate(el => {el.scrollTop = 0;});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      await page.screenshot({path:`_workspace/search-posters-${width}.png`,fullPage:true});
      results.push({width, passed:true});
    }
    await page.getByRole('button', {name:'기생충 선택'}).click();
    await page.getByText('2. 관람 기록', {exact:true}).waitFor();
    await page.getByLabel('관람 날짜').fill('2024-02-29');
    assert(errors.length === 0, errors.join('; '));
    return {results, errors};
  } finally {
    await page.unroute('**/api/**'); await page.unroute('https://image.tmdb.org/**');
    page.off('pageerror', onError); page.off('console', onConsole);
  }
})
