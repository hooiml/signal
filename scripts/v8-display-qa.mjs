import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';
const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Local fixture QA only.');
const before = process.argv.includes('--before');
const out = `.tmp/display-clarity/${before ? 'before' : 'after'}`;
await mkdir(out, {recursive:true});
const f = marketRequestFixture();
const market = await (await f.route.GET(f.request('market=US&mode=standard&enableSocial=true'))).json();
const saved = (await (await researchReadFixture().route.GET()).json()).data[0];
function research(symbol, market) {
 const result = structuredClone(researchSnapshotFixture);
 const data = result.data, now = new Date().toISOString();
 Object.assign(data,{symbol,market,fetchedAt:now});
 Object.assign(data.quote,{name:'Fixture company with a long readable name', currency:market==='MY'?'MYR':'USD',instrumentType:'EQUITY',observedAt:'2026-10-16T20:00:00Z',classification:{source:'Yahoo Finance',instrumentType:'EQUITY',sector:'Technology',industry:'Software',retrievedAt:now}});
 if(symbol!=='MISSING') {
  const period=(reportingPeriod,revenue,profit,cashFlow)=>({...data.fundamentals,history:undefined, reportingPeriod,source:'Yahoo Finance',currency:data.quote.currency,annualRevenue:revenue,annualNetIncome:profit,freeCashFlow:cashFlow,revenueGrowthPercent:null});
  const prior=period('2024-12-31',56737100000,4000000000,300000000);
  const latest=period('2025-12-31',67723100000,4768100000,-439700000);
  Object.assign(data.fundamentals,latest,{revenueGrowthPercent:19.4,history:[latest,prior]});
 }
 return result;
}
const browser = await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const report=[];
try {
 for(const width of [1440,768,390,320]) {
  const context=await browser.newContext({viewport:{width,height:width>900?1000:844},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/api/**', async route=>{
   const req=route.request(),url=new URL(req.url());
   assert.equal(req.method(),'GET','This read-only UI test must not mutate records.');
   if(url.pathname==='/api/owner/session')return route.fulfill({json:{success:true,data:{configured:true,unlocked:true}}});
   if(url.pathname==='/api/signals/v2')return route.fulfill({json:market});
   if(url.pathname.startsWith('/api/signals/'))return route.fulfill({status:503,json:{success:false,error:'Fixture archive unavailable'}});
   if(url.pathname==='/api/research/watchlist')return route.fulfill({json:{success:true,data:[saved],archivedSymbols:[]}});
   if(url.pathname.startsWith('/api/research/symbol/'))return route.fulfill({json:research(url.pathname.split('/').at(-1),url.searchParams.get('market'))});
   return route.fulfill({json:{success:true,data:[]}});
  });
  async function capture(name){
   await page.evaluate(()=>document.fonts.ready); await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});
   const geometry=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,viewportHeight:innerHeight,buttons:[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent, left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}));
   assert.ok(geometry.scrollWidth<=width+1,`${name}: document overflow at ${width}`);
   report.push({name,width,geometry});
  }
  await page.goto(`${base}/main-v8?market=US`);await page.getByTestId('connected-score').waitFor();
  await capture('market');
  if(!before){
   assert.equal(await page.getByRole('heading',{level:1}).innerText(),'Neutral');
   const rows=page.getByRole('region',{name:'Explore indicators'});
   assert.ok(!(await rows.innerText()).includes('applied weight'),'Weights stay in inspection, not scan rows.');
   await page.getByRole('region',{name:'Market assessment',exact:true}).locator('details > summary').first().click();
   assert.ok((await page.getByRole('region',{name:'Market assessment',exact:true}).innerText()).includes('not forecast accuracy'));
  }
  await page.goto(`${base}/research-v8?ticker=AAPL&market=US`);await page.getByTestId('research-price').filter({hasText:'USD 200'}).waitFor();
  await capture('research-overview');
  await page.getByRole('tab',{name:'Financials',exact:true}).click();
  await capture('research-financials');
  if(!before){
   const panel=page.getByRole('tabpanel');
   await panel.getByText('USD 67.72 billion',{exact:true}).waitFor();
   assert.ok((await panel.innerText()).includes('31 Dec 2024'));
   await panel.getByText('Exact amount and comparison',{exact:true}).first().click();
   await panel.getByText(/USD 67,723,100,000/).first().waitFor();
   assert.equal(await page.getByRole('heading',{name:'Growth and positive earnings reported',exact:true}).count(),0);
   await page.getByRole('button',{name:'Saved research',exact:true}).click();
   await page.getByRole('button',{name:'Read saved thesis',exact:true}).click();
   assert.equal(await page.getByRole('tab',{name:'Thesis',exact:true}).getAttribute('aria-selected'),'true');
   assert.ok(page.url().includes('ticker=AAPL'));
   await capture('research-saved');
  }
  await page.goto(`${base}/research-v8?ticker=MISSING&market=US`);await page.getByTestId('research-price').filter({hasText:'USD 200'}).waitFor();
  await capture('research-missing');
  if(!before)assert.match(await page.getByRole('region',{name:'Financial assessment status',exact:true}).innerText(), /Financial snapshot/i);
  assert.deepEqual(errors,[]);await context.close();
 }
} finally {await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({fixtureOnly:true,before,report},null,2));}
console.log(`Display clarity ${before?'baseline captured':'checks passed'}: ${report.length} states.`);
