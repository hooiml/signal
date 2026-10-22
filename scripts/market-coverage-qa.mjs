import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';

const base=process.env.SIGNAL_QA_URL||'http://127.0.0.1:3101';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const out='.tmp/market-coverage'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true}); const results=[];
try {
 for(const width of [1440,390,375]) {
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},serviceWorkers:'block'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/api/**',async route=>{
   const u=new URL(route.request().url());assert.equal(route.request().method(),'GET');
   if(u.pathname==='/api/signals/v2') {
    const fixture=marketRequestFixture({sourceConfiguration:{reddit:false,stockTwits:false},rawMarketData:{newsItems:[
     {title:'Recent market headline',source:'Fixture',link:'https://example.test/recent',pubDate:'2026-09-11T12:00:00.000Z'},
     {title:'Older market headline',source:'Fixture',link:'https://example.test/older',pubDate:'2026-09-01T00:00:00.000Z'},
     {title:'Undated market headline',source:'Fixture',link:'https://example.test/undated'},
    ]}});
    return route.fulfill({json:await (await fixture.route.GET(fixture.request(u.search.slice(1)))).json()});
   }
   return route.fulfill({status:503,json:{success:false,error:'Labelled fixture archive unavailable'}});
  });
  for(const market of ['US','MY']) {
   await page.goto(`${base}/main-v8?market=${market}`);await page.getByTestId('connected-score').waitFor();
   const graphic=page.getByRole('img',{name:/^Score weight:/});await graphic.waitFor();
   const ring=graphic.locator('..'); const legend=ring.locator('ul');
   const a=await graphic.boundingBox(),b=await legend.boundingBox();
   assert.ok(b.x>=a.x+a.width-1,'Legend must stay beside the chart, outside the narrow graphic column');
   assert.ok(b.width>=120,'Coverage labels must retain readable width');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await ring.screenshot({path:`${out}/${market}-coverage-${width}.png`});
   await page.locator(`[data-indicator="${market==='US'?'social':'news'}"]`).click();
   const source=market==='US'?/Reddit: OAuth is not configured/:/3 news items returned/;
   await page.locator('p:visible').filter({hasText:source}).first().waitFor();
   if(market==='MY')await page.locator('p:visible').filter({hasText:/1 dated within 24h of retrieval/}).first().waitFor();
   await page.screenshot({path:`${out}/${market}-source-${width}.png`,fullPage:true});
   results.push({width,market,passed:true});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
}finally{await browser.close();}
await writeFile(`${out}/report.json`,JSON.stringify({dataMode:'Controlled source fixtures; unavailable archive is intentional',results},null,2));
console.log('Market coverage layout and source evidence passed at 1440, 390 and 375px in US and MY.');
