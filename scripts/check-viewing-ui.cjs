// pnpm dlx @playwright/cli -s=routes run-code --filename=scripts/check-viewing-ui.cjs
// Dedicated mocked browser context: never writes personal records.
(async hostPage => {
  const context = await hostPage.context().browser().newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('dialog', dialog => dialog.accept());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()); });
  const origin = 'http://localhost:3002';
  const movie = {id:'11111111-1111-4111-8111-111111111111',title:'기생충',releaseDate:'2019-05-30',runtimeMinutes:132,posterUrl:null};
  const cinema = {id:'22222222-2222-4222-8222-222222222222',name:'테스트 극장',address:'서울 테스트로 1',status:'CLOSED'};
  const base = {id:'record-1', movie, cinema:null, watchedOn:'2026-09-15T00:00:00.000Z',watchedTime:null,viewingType:null,auditorium:'옛 상영관',screeningFormat:null,streamingService:null,viewingDetail:null,ratingHalfStars:0,note:'처음 기록'};
  let records, writes, failSave, user = 'fixture';
  const queries = [];
  await page.route('**/api/**', async route => {
    const raw = route.request().url().slice(origin.length);
    const url = {pathname:raw.split('?')[0],search:raw.includes('?') ? raw.slice(raw.indexOf('?')) : '',searchParams:{get:key => { const pair = raw.split('?')[1]?.split('&').find(item => item.split('=')[0] === key); return pair ? decodeURIComponent(pair.slice(pair.indexOf('=')+1).replaceAll('+',' ')) : null; }}};
    const method = route.request().method();
    if (url.pathname === '/api/auth/session') return route.fulfill({json:{user:{id:user,email:'viewer@example.test'},googleAvailable:true}});
    if (url.pathname === '/api/auth/logout') { user = 'other'; return route.fulfill({status:303,headers:{location:'/viewings'}}); }
    if (url.pathname === '/api/cinemas') return route.fulfill({json:url.searchParams.get('q') === '없음' ? [] : url.searchParams.get('q') === '많음' ? Array.from({length:20},(_,i)=>({...cinema,id:'cinema-'+i,name:'극장 '+i})) : [cinema]});
    if (url.pathname === '/api/movies/search') return route.fulfill({json:{page:1,totalPages:1,results:[{tmdbId:1,...movie}]}});
    if (url.pathname === '/api/movies/tmdb/1') return route.fulfill({json:movie});
    if (url.pathname === '/api/viewings' && method === 'GET') {
      queries.push(url.search);
      const rating = url.searchParams.get('rating') ?? 'all';
      const items = records.filter(record => rating === 'all' || (rating === 'unrated' ? record.ratingHalfStars === null : record.ratingHalfStars === Number(rating)*2));
      const pageNumber = Number(url.searchParams.get('page') || 1);
      return route.fulfill({json:{items:items.slice((pageNumber-1)*20,pageNumber*20),page:pageNumber,limit:20,totalItems:items.length,totalPages:Math.ceil(items.length/20)}});
    }
    if (url.pathname.startsWith('/api/viewings')) {
      const id = url.pathname.split('/')[3];
      const current = records.find(record => record.id === id);
      if (method === 'GET') return route.fulfill({status:current ? 200 : 404,json:current ?? {}});
      if (method === 'DELETE') { records = records.filter(record => record.id !== id); return route.fulfill({status:204}); }
      const data = route.request().postDataJSON(); writes.push({method,data});
      if (failSave) return route.fulfill({status:401,json:{}});
      const saved = {...(current ?? base),...data,id:current?.id ?? 'record-' + (records.length+1),movie,cinema:data.cinemaId ? cinema : null,watchedOn:data.watchedOn+'T00:00:00.000Z',ratingHalfStars:data.rating === null ? null : data.rating*2};
      records = [saved,...records.filter(record => record.id !== saved.id)];
      return route.fulfill({status:method === 'POST' ? 201 : 200,json:saved});
    }
    throw new Error('Unexpected API request: ' + method + ' ' + url.pathname);
  });
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  async function noOverflow() { assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow'); }
  async function startNew() {
    await page.goto(origin + '/viewings/new?watchedOn=2026-09-15');
    await page.getByLabel('영화 제목').fill('기생충');
    await page.getByRole('button',{name:'기생충 선택'}).click();
    await page.getByLabel('관람 날짜').waitFor();
  }
  const results = [];
  try {
    for (const width of [1280,390]) {
      records = [{...base}]; writes=[]; failSave=false; user='fixture';
      await page.setViewportSize({width,height:844});
      await page.emulateMedia({colorScheme:width === 390 ? 'dark' : 'light',reducedMotion:'reduce'});
      await page.goto(origin + '/viewings');
      await page.evaluate(() => sessionStorage.clear());
      await page.getByRole('heading',{name:'내 기록',exact:true}).waitFor();
      await page.getByRole('heading',{name:'기생충',exact:true}).waitFor();
      await noOverflow();
      await page.screenshot({path:'frontend/.impeccable/review/' + (width === 390 ? 'mobile' : 'desktop') + '.png',fullPage:true});
      await page.getByLabel('평점',{exact:true}).selectOption('0');
      await page.waitForURL('**/viewings?rating=0**');
      await page.getByRole('heading',{name:'기생충',exact:true}).click();
      await page.getByRole('link',{name:'수정',exact:true}).click();
      await page.getByLabel('메모').fill('레거시 평점 보존');
      await page.getByRole('button',{name:'관람 기록 저장'}).click();
      await page.getByRole('heading',{name:'관람 기록',exact:true}).waitFor();
      assert(writes.at(-1).data.rating === 0, 'legacy zero rating lost');
      assert(writes.at(-1).data.auditorium === '옛 상영관' && !('viewingType' in writes.at(-1).data), 'legacy auditorium lost');
      await page.getByRole('link',{name:'내 기록',exact:true}).click();
      await page.waitForURL('**/viewings?rating=0**');
      await page.getByLabel('평점',{exact:true}).waitFor();
      assert(page.url().includes('rating=0'),'return filter lost');
      await startNew();
      await page.getByLabel('시각').fill('19:30');
      await page.getByRole('radio',{name:'4.5점',exact:true}).check();
      await page.getByRole('button',{name:'극장',exact:true}).click();
      const input = page.getByRole('combobox',{name:'극장',exact:true});
      await input.fill('많음');
      await page.getByRole('option',{name:'극장 19 (폐업) 서울 테스트로 1',exact:true}).waitFor();
      for (let i=0;i<12;i++) await input.press('ArrowDown');
      assert(await input.evaluate(el => { const active=document.getElementById(el.getAttribute('aria-activedescendant')); const box=active.getBoundingClientRect(), parent=active.parentElement.getBoundingClientRect(); return box.top>=parent.top && box.bottom<=parent.bottom; }),'active cinema option hidden below scroll');
      if(width===390) await page.screenshot({path:'frontend/.impeccable/review/cinema-keyboard.png',fullPage:true});
      await input.fill('테스트');
      await page.getByRole('option',{name:/테스트 극장/}).waitFor();
      await input.press('ArrowDown'); await input.press('Enter');
      await page.getByLabel('상영관',{exact:true}).fill('1관');
      await page.getByLabel('상영 포맷').fill('IMAX');
      await page.getByRole('button',{name:'OTT',exact:true}).click();
      await page.getByLabel('플랫폼').fill('Netflix');
      await page.getByRole('button',{name:'극장',exact:true}).click();
      assert(await page.getByLabel('상영관',{exact:true}).inputValue() === '1관','type switch dropped values');
      await page.getByRole('button',{name:'OTT',exact:true}).click();
      await page.getByLabel('메모').fill('탭에서 복원할 메모');
      await page.getByRole('link',{name:'뒤로',exact:true}).click();
      await page.getByRole('heading',{name:'내 기록',exact:true}).waitFor();
      await page.goBack();
      await page.getByLabel('메모').waitFor();
      assert(await page.getByLabel('메모').inputValue() === '탭에서 복원할 메모','internal/back navigation lost draft');
      await page.reload();
      await page.getByText('이 탭의 임시 기록을 복원했어요.').waitFor();
      assert(await page.getByLabel('메모').inputValue() === '탭에서 복원할 메모','draft reload lost');
      assert(await page.getByLabel('시각').inputValue() === '19:30','time lost');
      await noOverflow();
      await page.screenshot({path:'frontend/.impeccable/review/form-' + width + '.png',fullPage:true});
      failSave=true;
      await page.getByRole('button',{name:'관람 기록 저장'}).click();
      await page.getByRole('alert').filter({hasText:'로그인이 만료됐어요.'}).waitFor();
      assert(await page.getByLabel('메모').inputValue() === '탭에서 복원할 메모','expiry lost draft');
      failSave=false;
      await page.getByRole('button',{name:'관람 기록 저장'}).click();
      await page.getByRole('heading',{name:'관람 기록',exact:true}).waitFor();
      const posted = writes.at(-1).data;
      assert(posted.viewingType === 'STREAMING' && posted.streamingService === 'Netflix' && posted.cinemaId === null && posted.auditorium === null && posted.screeningFormat === null,'inactive fields submitted');
      assert(posted.rating === 4.5 && posted.watchedTime === '19:30','rating/time contract');
      assert(await page.evaluate(() => !Object.keys(sessionStorage).some(key => key.startsWith('reelink:draft:'))),'draft not cleared');
      await page.getByRole('link',{name:'수정',exact:true}).click();
      await page.getByRole('button',{name:'기타',exact:true}).click();
      await page.getByLabel('관람 상세').fill('기내');
      await page.getByRole('radio',{name:'4.5점',exact:true}).click();
      await page.getByRole('button',{name:'관람 기록 저장'}).click();
      await page.getByRole('heading',{name:'관람 기록',exact:true}).waitFor();
      assert(writes.at(-1).method === 'PATCH' && writes.at(-1).data.rating === null && writes.at(-1).data.streamingService === null,'edit/clear contract');
      await page.getByRole('button',{name:'삭제',exact:true}).click();
      await page.getByRole('heading',{name:'내 기록',exact:true}).waitFor();
      assert(records.length === 1,'delete failed');
      await startNew();
      await page.getByLabel('메모').fill('버릴 기록');
      await page.getByRole('button',{name:'임시 기록 버리기'}).click();
      await page.getByRole('heading',{name:'내 기록',exact:true}).waitFor();
      await startNew();
      await page.getByLabel('메모').fill('다른 계정에 넘기지 않음');
      user='other';
      await page.reload();
      await page.getByLabel('영화 제목').waitFor();
      assert(await page.evaluate(() => !Object.keys(sessionStorage).some(key => key.startsWith('reelink:draft:fixture:'))),'account switch retained previous draft');
      results.push({width,passed:true});
    }
    records = Array.from({length:40},(_,i)=>({...base,id:'page-record-'+i}));
    await page.goto(origin + '/viewings?rating=all&sort=oldest&page=2');
    await page.getByText('2 / 2',{exact:true}).waitFor();
    await page.getByRole('heading',{name:'기생충',exact:true}).last().scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    await page.getByRole('heading',{name:'기생충',exact:true}).last().click();
    await page.getByRole('heading',{name:'관람 기록',exact:true}).waitFor();
    await page.getByRole('link',{name:'내 기록',exact:true}).click();
    await page.getByText('2 / 2',{exact:true}).waitFor();
    await page.waitForFunction(expected => Math.abs(scrollY - expected) < 10,scroll);
    assert(page.url().includes('sort=oldest') && page.url().includes('page=2'),'page/sort lost');
    records = records.slice(0,1);
    await page.reload();
    await page.getByRole('link',{name:'첫 페이지로'}).click();
    await page.getByRole('heading',{name:'기생충',exact:true}).waitFor();
    assert(errors.length === 0, JSON.stringify(errors));
    return {results,consoleErrors:errors,checks:'pagination/scroll/filter return; create/edit/delete; legacy zero/context; cinema keyboard; type retention; draft reload/back/discard/account isolation; expiry; light/dark overflow'};
  } finally { await context.close(); }
})
