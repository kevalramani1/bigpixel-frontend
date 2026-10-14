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
    for (const img of await images.all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(image => image.decode());
    }
    await page.waitForFunction(columns => {
      const images = [...document.querySelectorAll('img[alt^="Photo "]')];
      return images.every((image, index) => {
        const rect = image.getBoundingClientRect();
        const ratio = image.naturalWidth/image.naturalHeight;
        const rowStart = images[Math.floor(index/columns)*columns].getBoundingClientRect();
        return Math.abs(rect.width/rect.height-ratio)<0.01 && Math.abs(rect.y-rowStart.y)<1;
      });
    }, columns);
    const layout = await images.evaluateAll(images => images.map(image => {
      const rect = image.getBoundingClientRect();
      return { x:rect.x, y:rect.y, width:rect.width, height:rect.height, naturalRatio:image.naturalWidth/image.naturalHeight };
    }));
    assert.equal(layout.length, photos.length);
    for (let start=0; start<layout.length; start+=columns) {
      const row=layout.slice(start,start+columns);
      assert.ok(Math.abs(row[0].x-4)<1);
      assert.ok(Math.abs(row.at(-1).x+row.at(-1).width-(width-4))<1, 'row fills available width');
      for (let index=0; index<row.length; index++) {
        assert.ok(Math.abs(row[index].height-row[0].height)<1, 'equal row height without empty areas');
        assert.ok(Math.abs(row[index].width/row[index].height-row[index].naturalRatio)<0.01, 'original ratio preserved');
        if(index>0) assert.ok(Math.abs(row[index].x-row[index-1].x-row[index-1].width-6)<1, 'left-to-right order and horizontal gap');
      }
      if(start+columns<layout.length) assert.ok(Math.abs(layout[start+columns].y-row[0].y-row[0].height-6)<1, 'only 6px between rows');
    }
    await page.getByRole('button', { name:'View Gallery', exact:true }).click();
    await page.waitForFunction(() => document.querySelector('img[alt="Photo 1"]').getBoundingClientRect().y<180);
    if (process.env.GALLERY_SCREENSHOT_DIR) await page.screenshot({ path:`${process.env.GALLERY_SCREENSHOT_DIR}/gallery-rows-${width}.png` });
    await images.nth(1).click();
    const viewer=page.getByAltText('Viewer', { exact:true });
    await viewer.waitFor();
    assert.equal(await viewer.getAttribute('src'),photos[1].url, 'clicked photo matches viewer');
    await page.keyboard.press('Escape');
    console.log(`${width}px: ${columns} photos per row, original ratios, full-width rows, 6px gaps and lightbox passed`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
