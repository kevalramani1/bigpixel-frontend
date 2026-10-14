// Start the frontend dev server, then run: node tests/gallery-lazy-loading.browser.mjs
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GALLERY_TEST_URL || 'http://localhost:5174';
const browser = await chromium.launch({ headless:true, ...(process.env.CHROME_PATH ? { executablePath:process.env.CHROME_PATH } : {}) });

async function fixture(failFirst = false, width = 1440, gateSecond = false) {
  const columns = width >= 1024 ? 4 : 2;
  const page = await browser.newPage({ viewport:{ width,height:900 } });
  const requests = [];
  const errors = [];
  let generation = 0;
  let failing = failFirst;
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  let releaseSecond;
  const secondGate = new Promise(resolve => { releaseSecond = resolve; });
  if (!gateSecond) releaseSecond();
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/galleries/lazy-test/public*',route=>{
    generation++;
    const photos=Array.from({length:200},(_,index)=>({id:index+1,order_index:index,url:`${base}/test-gallery-assets/original-${index+1}.svg?v=${generation}`,preview_url:`${base}/test-gallery-assets/preview-${index+1}.svg?v=${generation}`}));
    return route.fulfill({json:{id:1,slug:'lazy-test',name:'Lazy loading',is_locked:false,unlocked:true,allow_download:false,allow_bulk_download:false,photos}});
  });
  await page.route('**/test-gallery-assets/**',async route=>{
    const url=new URL(route.request().url());
    const id=Number(url.pathname.match(/-(\d+)\.svg$/)[1]);
    const version=Number(url.searchParams.get('v'));
    requests.push({id,version});
    if(id===1) await firstGate;
    if(id===columns+1) await secondGate;
    if(failing&&id===1) return route.fulfill({status:403,body:'Expired image URL'});
    const [width,height]=[[1600,900],[900,1600],[1600,900],[1000,1000]][(id-1)%4];
    return route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="steelblue"/></svg>`});
  });
  await page.goto(`${base}/gallery/lazy-test`);
  await page.waitForFunction(()=>document.querySelector('[data-photo-id="1"]')?.getAttribute('aria-busy')==='true');
  return {page,requests,errors,releaseFirst,releaseSecond,columns,allowRetry:()=>{failing=false;}};
}

async function assertPendingBatch(app, start) {
  await app.page.waitForFunction(({start,columns})=>
    Array.from({length:columns-1},(_,index)=>document.querySelector(`img[alt="Photo ${start+index+1}"]`))
      .every(image=>image?.complete&&image.naturalWidth>0), {start,columns:app.columns});
  for(let id=start;id<start+app.columns;id++) {
    assert.ok(app.requests.some(request=>request.id===id),'every photo in the batch downloads together');
    assert.ok(!(await app.page.getByAltText(`Photo ${id}`,{exact:true}).getAttribute('class')).includes('opacity-100'),'completed siblings stay hidden until the whole batch is ready');
  }
  assert.ok(!(await app.page.getByAltText(`Photo ${start+app.columns}`,{exact:true}).getAttribute('class')).includes('opacity-100'),'following row stays hidden while the current row is pending');
}

try {
  const app=await fixture(false,1440,true);
  assert.equal(await app.page.locator('img[alt^="Photo "]').count(),200);
  assert.equal(await app.page.getByAltText('Photo 200',{exact:true}).getAttribute('src'),null,'far-away photo has no source URL yet');
  assert.ok(app.requests.length<200,'opening a gallery does not request every photo');
  await app.page.waitForFunction(()=>getComputedStyle(document.querySelector('img[alt="Photo 1"]')).opacity==='0');
  assert.equal(await app.page.getByAltText('Photo 1',{exact:true}).evaluate(image=>getComputedStyle(image).opacity), '0', 'placeholder remains visible while download is pending');
  await assertPendingBatch(app,1);
  await assertPendingBatch(app,5);
  assert.equal(await app.page.getByAltText('Photo 9',{exact:true}).getAttribute('src'),null,'at most two rows download at once');
  assert.ok(app.requests.some(request=>request.id===5),'second row starts downloading before the slow first row finishes');
  app.releaseFirst();
  await app.page.waitForFunction(()=>[1,2,3,4].every(id=>document.querySelector(`img[alt="Photo ${id}"]`)?.classList.contains('opacity-100')));
  await assertPendingBatch(app,5);
  app.releaseSecond();
  await app.page.getByAltText('Photo 200',{exact:true}).scrollIntoViewIfNeeded();
  await app.page.waitForFunction(()=>document.querySelector('img[alt="Photo 200"]')?.classList.contains('opacity-100'));
  assert.ok(app.requests.some(request=>request.id===200),'scrolling starts the deferred download');
  const count=app.requests.filter(request=>request.id===200).length;
  await app.page.setViewportSize({width:390,height:844});
  await app.page.getByAltText('Photo 200',{exact:true}).scrollIntoViewIfNeeded();
  assert.equal(app.requests.filter(request=>request.id===200).length,count,'resizing does not reload an already loaded photo');
  await app.page.getByAltText('Photo 200',{exact:true}).click();
  const viewer=app.page.getByAltText('Viewer',{exact:true});
  await viewer.waitFor();
  assert.match(await viewer.getAttribute('src'),/preview-200\.svg/,'lightbox opens the selected photo directly');
  assert.deepEqual(app.errors,[]);
  await app.page.close();
  console.log('Desktop: 4-photo rows preload with two-row concurrency and reveal in order; 200-photo lazy loading, resize and lightbox passed');

  const mobile=await fixture(false,390,true);
  await assertPendingBatch(mobile,1);
  await assertPendingBatch(mobile,3);
  assert.equal(await mobile.page.getByAltText('Photo 5',{exact:true}).getAttribute('src'),null,'mobile preloading is also bounded to two rows');
  mobile.releaseSecond();
  await mobile.page.waitForFunction(()=>[3,4].every(id=>{
    const image=document.querySelector(`img[alt="Photo ${id}"]`);
    return image?.complete&&image.naturalWidth>0&&!image.classList.contains('opacity-100');
  }));
  mobile.releaseFirst();
  await mobile.page.waitForFunction(()=>[1,2,3,4].every(id=>document.querySelector(`img[alt="Photo ${id}"]`)?.classList.contains('opacity-100')));
  assert.deepEqual(mobile.errors,[]);
  await mobile.page.close();
  console.log('Mobile: completed preloaded 2-photo row waits for the first row, then appears without another download');

  const retry=await fixture(true);
  retry.releaseFirst();
  await retry.page.getByRole('button',{name:'Retry photo 1',exact:true}).waitFor();
  await retry.page.evaluate(()=>{
    document.documentElement.style.scrollBehavior='auto';
    const photo=document.querySelector('[data-photo-id="1"]');
    window.scrollTo(0,photo.getBoundingClientRect().top+window.scrollY-140);
  });
  const oldVersion=Number(new URL(await retry.page.getByAltText("Photo 1",{exact:true}).getAttribute("src")).searchParams.get("v"));
  const position=await retry.page.evaluate(()=>window.scrollY);
  retry.allowRetry();
  await retry.page.getByRole('button',{name:'Retry photo 1',exact:true}).click();
  await retry.page.waitForFunction(()=>document.querySelector('img[alt="Photo 1"]')?.classList.contains('opacity-100'));
  const newVersion=Number(new URL(await retry.page.getByAltText('Photo 1',{exact:true}).getAttribute('src')).searchParams.get('v'));
  assert.ok(newVersion>oldVersion,'retry fetches fresh image URLs');
  assert.ok(Math.abs(await retry.page.evaluate(()=>window.scrollY)-position)<1,'retry preserves scroll position');
  assert.equal(await retry.page.getByAltText('Photo 200',{exact:true}).getAttribute('src'),null,'retry still defers distant photos');
  assert.deepEqual(retry.errors,[]);
  await retry.page.close();
  console.log('Failed image: accessible retry refreshes expired URLs, preserves scroll position and keeps distant images deferred');
} finally {
  await browser.close();
}
