// Start the frontend dev server, then run: node tests/gallery-zip.browser.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GALLERY_TEST_URL || 'http://localhost:5174';
const browser = await chromium.launch({headless:true,args:['--js-flags=--max-old-space-size=128'],...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
const preview='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"/>').toString('base64');

async function fixture({count=8,size=1024,failure,locked=false}={}) {
  const page=await browser.newPage();
  page.setDefaultTimeout(120_000);
  const stats={active:0,maxActive:0,attempts:new Map(),apiCalls:0,errors:[],downloads:0};
  page.on('pageerror',error=>stats.errors.push(error.message));
  page.on('download',()=>stats.downloads++);
  await page.addInitScript(({locked,failure})=>{
    if(locked) localStorage.setItem('gallery_pin_zip-test','1357');
    // Whole-response buffering must never be used by the ZIP path.
    Response.prototype.blob=async()=>{throw new Error('Unexpected whole-response buffering');};
    Response.prototype.arrayBuffer=async()=>{throw new Error('Unexpected whole-response buffering');};
    if(failure==='quota') {
      const original=FileSystemFileHandle.prototype.createWritable;
      FileSystemFileHandle.prototype.createWritable=function(...args) {
        if(this.name==='photo') return Promise.reject(new DOMException('Storage full','QuotaExceededError'));
        return original.apply(this,args);
      };
    }
    if(failure==='body') {
      const original=window.fetch;
      let failed=false;
      window.fetch=async(...args)=>{
        if(String(args[0]).includes('/zip-assets/3.jpg')&&!failed) {
          failed=true;
          return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1,2,3]));controller.error(new TypeError('Connection interrupted'));}}),{headers:{'Content-Type':'image/jpeg'}});
        }
        return original(...args);
      };
    }
  },{locked,failure});
  await page.route('**/api/galleries/zip-test/public*',route=>{
    stats.apiCalls++;
    const unlocked=!locked||new URL(route.request().url()).searchParams.get('pin')==='1357';
    const photos=unlocked?Array.from({length:count},(_,i)=>({id:i+1,order_index:i,url:`${base}/zip-assets/${i+1}.jpg?v=${stats.apiCalls}`,preview_url:preview})):[];
    return route.fulfill({json:{id:1,slug:'zip-test',name:'Large gallery',is_locked:locked,unlocked,allow_download:false,allow_bulk_download:true,photos}});
  });
  await page.route('**/zip-assets/*',async route=>{
    const id=Number(new URL(route.request().url()).pathname.match(/\/(\d+)\.jpg/)[1]);
    const attempt=(stats.attempts.get(id)||0)+1;
    stats.attempts.set(id,attempt);
    stats.active++;
    stats.maxActive=Math.max(stats.maxActive,stats.active);
    try {
      if(failure==='expired'&&id===3&&attempt===1||failure==='permanent'&&id===3) return await route.fulfill({status:403,body:'Expired URL'});
      if(failure==='network'&&id===3&&attempt===1) return await route.abort('connectionfailed');
      if(failure==='cancel') await new Promise(resolve=>setTimeout(resolve,1000));
      const body=Buffer.alloc(size,id%251);
      body.writeUInt32LE(id);
      await route.fulfill({contentType:'image/jpeg',body});
    } finally {stats.active--;}
  });
  await page.goto(`${base}/gallery/zip-test`);
  await page.getByTitle('Download All',{exact:true}).waitFor();
  return {page,stats,count,size};
}

async function download(app) {
  const event=app.page.waitForEvent('download',{timeout:120_000});
  await app.page.getByTitle('Download All',{exact:true}).click();
  const item=await event;
  assert.equal(await item.failure(),null);
  assert.equal(item.suggestedFilename(),'Large gallery.zip');
  const data=await readFile(await item.path());
  assert.ok(data.includes(Buffer.from([0x50,0x4b,0x06,0x06])),'ZIP64 records are present for archives beyond 4 GiB');
  const archive=await JSZip.loadAsync(data,{checkCRC32:true});
  const files=Object.values(archive.files).filter(file=>!file.dir);
  assert.deepEqual(files.map(file=>file.name),Array.from({length:app.count},(_,i)=>`large_gallery/photo_${i+1}.jpg`));
  for(const i of [0,2,Math.floor(app.count/2),app.count-1]) {
    const bytes=await files[i].async('nodebuffer');
    assert.equal(bytes.length,app.size);
    assert.equal(bytes.readUInt32LE(),i+1,'original content and gallery order preserved');
  }
  assert.equal(app.stats.maxActive,1,'one original is downloaded at a time');
  assert.match(await app.page.getByRole('link',{name:'Download ZIP',exact:true}).getAttribute('href'),/^blob:/,'ready ZIP also has a direct link if the automatic download is blocked');
  assert.deepEqual(app.stats.errors,[]);
  await app.page.close();
}

async function assertCleaned(app) {
  await app.page.waitForFunction(async()=>{
    try {
      const directory=await (await navigator.storage.getDirectory()).getDirectoryHandle('bigpixel-downloads');
      const entries=[];
      for await(const entry of directory.keys()) entries.push(entry);
      return entries.length===0;
    } catch(error) { if(error.name==='NotFoundError') return true; throw error; }
  });
  assert.equal(app.stats.downloads,0,'failed/cancelled exports never download a partial ZIP');
  assert.ok(await app.page.getByTitle('Download All',{exact:true}).isEnabled());
}

try {
  await download(await fixture({count:400,size:256*1024,locked:true}));
  console.log('400 photos / 100 MiB: disk-backed ZIP with a 128 MiB JS heap, all CRCs valid, originals/order/PIN preserved, no Response.blob/arrayBuffer');
  for(const failure of ['expired','network','body']) {
    const app=await fixture({failure});
    const initialApiCalls=app.stats.apiCalls;
    await download(app);
    assert.ok(app.stats.apiCalls>=initialApiCalls+2,'retry refreshes signed URLs after the initial download refresh');
    console.log(`${failure}: download recovers without missing or duplicate photos`);
  }
  for(const failure of ['permanent','quota','cancel']) {
    const app=await fixture({failure});
    const pending=failure==='cancel'?app.page.waitForRequest(request=>request.url().includes('/zip-assets/')):null;
    await app.page.getByTitle('Download All',{exact:true}).click();
    if(failure==='cancel') {
      await pending;
      await app.page.getByRole('button',{name:'Cancel',exact:true}).click();
    }
    else await app.page.getByRole('alert').waitFor();
    await assertCleaned(app);
    if(failure==='permanent') {
      assert.equal(app.stats.attempts.get(3),3);
      assert.match(await app.page.getByRole('alert').innerText(),/Photo 3.*403/);
    }
    if(failure==='quota') assert.match(await app.page.getByRole('alert').innerText(),/free storage/);
    assert.deepEqual(app.stats.errors,[]);
    await app.page.close();
    console.log(`${failure}: clear error/cancel, partial files removed and Download All enabled again`);
  }
} finally {await browser.close();}
