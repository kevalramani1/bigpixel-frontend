// Start the frontend dev server, then run: node tests/gallery-layout.browser.mjs
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const dimensions = [[1600,900],[900,1600],[1600,900],[1600,900],[900,1600],[1200,1200],[1600,900],[900,1600],[1600,900]];
const photos = dimensions.map(([width,height], index) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="hsl(${index*33},35%,42%)"/><rect x="16" y="16" width="${width-32}" height="${height-32}" fill="none" stroke="white" stroke-width="8"/><text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="78" fill="white">${index+1}</text></svg>`;
  return { id:index+1, order_index:index, url:`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` };
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/galleries/layout-test/public*', route => route.fulfill({ json: { id:1, slug:'layout-test', name:'Mixed ratios', is_locked:false, unlocked:true, allow_download:false, allow_bulk_download:false, photos } }));
  await page.setViewportSize({ width:390, height:844 });
  await page.goto(`${process.env.GALLERY_TEST_URL || 'http://localhost:5174'}/gallery/layout-test`);
  for (const [width,height,columns] of [[390,844,2],[1440,900,4],[768,900,2],[1440,900,4]]) {
    await page.setViewportSize({ width,height });
    const images = page.locator('img[alt^="Photo "]');
    await images.first().waitFor();
    for (let index=0; index<photos.length; index++) {
      await images.nth(index).scrollIntoViewIfNeeded();
      await page.waitForFunction(index => {
        const image=document.querySelector(`img[alt="Photo ${index+1}"]`);
        return image?.complete && image.naturalWidth>0;
      },index);
    }
    await page.waitForFunction(columns => {
      const images = [...document.querySelectorAll('img[alt^="Photo "]')];
      const expectedWidth=(document.documentElement.clientWidth-8-6*(columns-1))/columns;
      return images.every(image => {
        const rect=image.getBoundingClientRect();
        return Math.abs(rect.width-expectedWidth)<1 && Math.abs(rect.width/rect.height-image.naturalWidth/image.naturalHeight)<0.01;
      });
    }, columns);
    const layout = await images.evaluateAll(images => images.map(image => {
      const rect = image.getBoundingClientRect();
      return { x:rect.x, y:rect.y, width:rect.width, height:rect.height, naturalRatio:image.naturalWidth/image.naturalHeight };
    }));
    assert.equal(layout.length, photos.length);
    const columnX=[...new Set(layout.map(item=>Math.round(item.x)))];
    assert.equal(columnX.length,columns,'equal-width masonry columns');
    for(let index=0;index<columns;index++) {
      assert.ok(Math.abs(layout[index].y-layout[0].y)<1,'first photos start left to right');
      if(index>0) assert.ok(layout[index].x>layout[index-1].x,'first photos follow gallery order');
    }
    for(const x of columnX) {
      const column=layout.filter(item=>Math.round(item.x)===x).sort((a,b)=>a.y-b.y);
      for(let index=0;index<column.length;index++) {
        const item=column[index];
        assert.ok(Math.abs(item.width/item.height-item.naturalRatio)<0.01,'original ratio preserved without crop or stretch');
        assert.ok(item.x>=0&&item.x+item.width<=width,'no horizontal overflow');
        if(index>0) assert.ok(Math.abs(item.y-column[index-1].y-column[index-1].height-6)<1,'6px spacing with no empty column gaps');
      }
    }
    await page.getByRole('button', { name:'View Gallery', exact:true }).click();
    await page.waitForFunction(() => document.querySelector('img[alt="Photo 1"]').getBoundingClientRect().y<180);
    if (process.env.GALLERY_SCREENSHOT_DIR) await page.screenshot({ path:`${process.env.GALLERY_SCREENSHOT_DIR}/gallery-masonry-${width}.png` });
    await images.nth(1).click();
    const viewer=page.getByAltText('Viewer', { exact:true });
    await viewer.waitFor();
    assert.equal(await viewer.getAttribute('src'),photos[1].url, 'clicked photo matches viewer');
    await page.keyboard.press('Escape');
    console.log(`${width}px: ${columns} masonry columns, original ratios, no column gaps, resizing and lightbox passed`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
