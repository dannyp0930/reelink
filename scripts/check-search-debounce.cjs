// pnpm dlx @playwright/cli -s=debounce run-code --filename=scripts/check-search-debounce.cjs
// UI-only fixtures; no Google or personal DB writes. Clock controls debounce time.
(async page => {
  const origin = 'http://localhost:3002';
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const requests = [];
  const errors = [];
  let expectedFailure = false;
  const onError = error => errors.push(error.message);
  const onConsole = message => { if (message.type() === 'error' && !expectedFailure) errors.push(message.text()); };
  page.on('pageerror', onError); page.on('console', onConsole);
  await page.route('**/api/**', route => {
    const url = route.request().url();
    const path = url.slice(origin.length).split('?')[0];
    if (path === '/api/auth/session') return route.fulfill({json:{user:{id:'fixture',email:'viewer@example.test',role:'USER'},googleAvailable:true}});
    if (path === '/api/viewings') return route.fulfill({json:{items:[],page:1,limit:50,totalItems:0,totalPages:0}});
    if (path === '/api/cinemas') return route.fulfill({json:[]});
    if (path === '/api/movies/search') {
      const q = decodeURIComponent(url.match(/[?&]q=([^&]*)/)[1]);
      requests.push(q);
      if (q === 'fail') return route.fulfill({status:503,json:{}});
      return route.fulfill({json:{page:Number(url.match(/[?&]page=(\d+)/)?.[1] || 1),totalPages:2,results:[{tmdbId:1,title:q,originalTitle:null,releaseDate:null,posterUrl:null}]}});
    }
    return route.abort();
  });
  const results = [];
  try {
    await page.clock.install();
    for (const width of [1280,390]) {
      await page.setViewportSize({width,height:844});
      await page.emulateMedia({colorScheme:width === 390 ? 'dark' : 'light'});
      await page.goto(origin + '/viewings/new');
      const input = page.getByLabel('영화 제목');
      await input.waitFor();
      assert(await page.getByRole('button',{name:'영화 검색',exact:true}).count() === 0, 'Redundant search button still visible');
      assert(await page.locator('#search-scroll-hint').count() === 0, 'Redundant scroll helper still visible');
      assert(await page.locator('#movie-search-hint').count() === 0, 'Unnecessary search helper still visible');
      assert(await input.getAttribute('aria-describedby') === null, 'Removed helper left a dangling description');
      // Measure elapsed browser time: runFor advances the clock in addition to
      // real time between automation calls, so a 399ms boundary assertion flakes.
      await page.evaluate(() => {
        window.__debounceTiming = {lastInput:0, requests:[]};
        document.addEventListener('input', event => {
          if (event.target.id === 'movie-query') window.__debounceTiming.lastInput = performance.now();
        }, true);
        const originalFetch = window.fetch;
        window.fetch = (url, options) => {
          if (String(url).includes('/movies/search?')) {
            window.__debounceTiming.requests.push({q:new URL(url, location.origin).searchParams.get('q'), elapsed:performance.now() - window.__debounceTiming.lastInput});
          }
          return originalFetch(url, options);
        };
      });
      requests.length = 0;
      await input.fill('기'); await page.clock.runFor(200);
      await input.fill('기생'); await page.clock.runFor(200);
      assert(requests.length === 0, 'Search fired before debounce');
      await input.fill('기생충'); await page.clock.runFor(400);
      await page.getByRole('button',{name:'기생충 선택'}).waitFor({timeout:5000});
      assert(await page.evaluate(() => window.__debounceTiming.requests.find(item => item.q === '기생충').elapsed >= 400), 'Debounce shorter than 400ms');
      assert(requests.join() === '기생충', 'Burst must yield one search');
      await input.fill('즉시');
      await input.press('Enter');
      await page.getByRole('button',{name:'즉시 선택'}).waitFor();
      await page.clock.runFor(500);
      assert(requests.filter(q => q === '즉시').length === 1, 'Enter must cancel delayed duplicate');
      const before = requests.length;
      await input.fill('');
      const ime = await page.context().newCDPSession(page);
      await ime.send('Input.imeSetComposition', {text:'한',selectionStart:1,selectionEnd:1});
      await page.clock.runFor(200);
      await ime.send('Input.imeSetComposition', {text:'한글',selectionStart:2,selectionEnd:2});
      await page.clock.runFor(400);
      await page.getByRole('button',{name:'한글 선택'}).waitFor();
      assert(await page.evaluate(() => window.__debounceTiming.requests.find(item => item.q === '한글').elapsed >= 400), 'IME debounce shorter than 400ms');
      assert(await input.evaluate(el => el === document.activeElement), 'IME search required blur');
      assert(requests.length === before + 1, 'Paused IME needs exactly one search');
      await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true,cancelable:true});
      assert(requests.length === before + 1, 'IME confirmation Enter submitted again');
      await ime.send('Input.insertText', {text:'한글'});
      await page.clock.runFor(500);
      assert(requests.length === before + 1, 'Committing unchanged IME text repeated search');
      await ime.detach();
      await page.getByRole('button',{name:'다음 검색 결과'}).click();
      await page.getByText('2 / 2 페이지').waitFor();
      await input.fill(''); await page.clock.runFor(600);
      assert(await page.getByRole('region',{name:'영화 검색 결과'}).count() === 0, 'Empty input must clear results');
      expectedFailure = true;
      await input.fill('fail'); await page.clock.runFor(400);
      await page.getByRole('alert').filter({hasText:'검색하지 못했어요.'}).waitFor();
      assert(await input.evaluate(el => el === document.activeElement), 'Automatic search failure stole typing focus');
      await input.fill('복구'); await page.clock.runFor(400);
      await page.getByRole('button',{name:'복구 선택'}).waitFor();
      expectedFailure = false;

      // Deliberately let old fetch resolve despite abort to verify stale-response protection.
      await page.evaluate(() => {
        const realFetch = window.fetch;
        window.__searchProbe = {};
        window.fetch = (url, options) => {
          if (String(url).includes('/movies/search?') && String(url).includes('q=slow')) {
            window.__searchProbe.signal = options.signal;
            return new Promise(resolve => {window.__searchProbe.release = () => resolve(new Response(JSON.stringify({page:1,totalPages:1,results:[{tmdbId:2,title:'stale',originalTitle:null,releaseDate:null,posterUrl:null}]})));});
          }
          return realFetch(url, options);
        };
      });
      await input.fill('slow'); await page.clock.runFor(400);
      await page.waitForFunction(() => !!window.__searchProbe?.release);
      assert(await input.isEnabled(), 'Search must not lock typing');
      await input.fill('new');
      assert(await page.evaluate(() => window.__searchProbe.signal.aborted), 'New input must abort old fetch immediately');
      await page.clock.runFor(400);
      await page.getByRole('button',{name:'new 선택'}).waitFor();
      await page.evaluate(() => window.__searchProbe.release());
      await page.clock.runFor(50);
      assert(await page.getByRole('button',{name:'stale 선택'}).count() === 0, 'Late response replaced current result');
      assert(await page.getByRole('button',{name:'new 선택'}).count() === 1, 'Latest result lost');
      await input.fill('slow'); await page.clock.runFor(400);
      await input.fill('');
      await page.evaluate(() => window.__searchProbe.release());
      await page.clock.runFor(50);
      assert(await page.getByRole('region',{name:'영화 검색 결과'}).count() === 0, 'Late response repopulated cleared input');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Horizontal overflow');
      results.push({width,passed:true});
    }
    assert(errors.length === 0, errors.join('; '));
    return {results, errors};
  } finally { await page.unroute('**/api/**'); page.off('pageerror',onError); page.off('console',onConsole); }
})
