import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';
const base=process.env.SIGNAL_QA_URL||'http://127.0.0.1:3101';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Fixture QA requires localhost');
const out='.tmp/bounded-slice/browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const report=[];
const fixture=researchReadFixture(); const saved=(await (await fixture.route.GET()).json()).data[0];
function snapshot(symbol,market) {
 const r=structuredClone(researchSnapshotFixture);
 Object.assign(r.data,{symbol,market,fetchedAt:new Date().toISOString()});
 Object.assign(r.data.quote,{name:symbol==='MAYBANK'?'Malayan Banking Berhad':`Fixture ${symbol}`,price:symbol==='MSFT'?400:200,currency:market==='MY'?'MYR':'USD',instrumentType:symbol==='VOO'?'ETF':'EQUITY',observedAt:'2026-10-02T20:00:00.000Z'});
 Object.assign(r.data.fundamentals,{source:market==='MY'?'Yahoo Finance':'SEC EDGAR',reportingPeriod:'2025-12-31',revenueGrowthPercent:10,annualRevenue:1000,annualNetIncome:100,freeCashFlow:80});
 r.data.fundamentals.history=[{...r.data.fundamentals,currency:market==='MY'?'MYR':'USD'}];
 r.data.warnings=[];
 if(symbol==='PARTIAL'){r.data.fundamentals.freeCashFlow=null;r.data.warnings=['Fixture cash flow unavailable'];}
 if(symbol==='MISSING'){for(const key of ['revenueGrowthPercent','annualNetIncome','freeCashFlow'])r.data.fundamentals[key]=null;}
 if(symbol==='UNKNOWN')r.data.quote.instrumentType=null;
 if(symbol==='WRONG')r.data.symbol='AAPL';
 return r;
}
try {
 for(const width of [1280,768,375]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/status of (500|503)/.test(m.text()))errors.push(m.text());});
 page.on('requestfailed',r=>{if(!/ERR_ABORTED/.test(r.failure()?.errorText??''))errors.push(r.failure()?.errorText);});
 const posts=[];let list=[];let release;let held;let watchlistFails=false;let saveFails=false;let listHold;let releaseList;
 await context.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.pathname==='/api/signals/v2'){const f=marketRequestFixture();const response=await f.route.GET(f.request(u.search.slice(1)));return route.fulfill({json:await response.json()});}
  if(u.pathname.startsWith('/api/signals/'))return route.fulfill({status:503,json:{success:false,error:'Fixture archive unavailable'}});
  if(u.pathname==='/api/research/watchlist') {
   if(req.method()==='POST') {const body=req.postDataJSON();posts.push(body);if(saveFails)return route.fulfill({status:500,json:{success:false,error:'fixture save failure'}});const record={...structuredClone(saved),symbol:body.symbol,market:body.market,companyName:body.companyName,thesisStrength:'unknown',whyInterested:'',notes:'',decisionJournal:{...saved.decisionJournal,decision:'Not recorded',confidence:'unrecorded'},reviewHistory:[]};list=[record];return route.fulfill({status:201,json:{success:true,data:record}});}
   const capturedList=structuredClone(list);if(listHold)await new Promise(resolve=>{releaseList=resolve;});
   return route.fulfill({status:watchlistFails?500:200,json:{success:!watchlistFails,data:capturedList,archivedSymbols:[]}});
  }
  if(u.pathname.includes('/api/research/symbol/')) {
   const symbol=decodeURIComponent(u.pathname.split('/').at(-1));
   if(symbol==='SLOW') { held=true;await new Promise(r=>{release=r;}); }
   return route.fulfill({json:snapshot(symbol,u.searchParams.get('market'))}).catch(()=>{});
  }
  assert.equal(req.method(),'GET','No unexpected mutation');return route.fulfill({json:{success:true,data:[]}});
 });
 async function read(symbol,market='US') {await page.getByLabel('Security ticker',{exact:true}).fill(symbol);await page.getByLabel('Lookup market',{exact:true}).selectOption(market);await page.getByRole('button',{name:'Read security',exact:true}).click();}
 async function heading(text){await page.getByRole('heading',{name:text,exact:true}).waitFor();}
 async function noOverflow(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow ${width}`);}
 await page.goto(`${base}/research-v8?ticker=AAPL&market=US`);
 await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'USD 200');assert.equal(posts.length,0);
 await noOverflow();await page.screenshot({path:`${out}/research-${width}.png`,fullPage:true});
 const formBoxes=await page.getByRole('form',{name:'Security lookup'}).locator('input,select,button').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}}));
 for(let i=0;i<formBoxes.length;i++)for(let j=i+1;j<formBoxes.length;j++){const a=formBoxes[i],b=formBoxes[j];assert.ok(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,'Lookup controls overlap');}
 await read('5347','MY');await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'MYR 200');assert.equal(posts.length,0);await page.getByRole('tab',{name:'Financials',exact:true}).click();await page.locator('dd').filter({hasText:/^MYR 1,000$/}).waitFor();
 await read('PARTIAL');await heading('Partial financial picture');assert.equal(await page.getByTestId('research-price').innerText(),'USD 200');
 await read('MISSING');await heading('Not enough financial data');
 for(const symbol of ['VOO','MAYBANK','UNKNOWN']){await read(symbol,symbol==='MAYBANK'?'MY':'US');await heading('Assessment not supported for this security');assert.match(await page.getByTestId('research-price').innerText(),/200/);await page.getByRole('tab',{name:'Financials',exact:true}).click();await page.getByRole('heading',{name:'Business performance'}).waitFor();}
 await read('WRONG');await heading('Provider refresh failed · assessment limited');assert.equal(await page.getByTestId('research-price').innerText(),'Unavailable');
 await read('SLOW');await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='SLOW');assert.equal(await page.getByTestId('research-price').innerText(),'Loading…');await page.waitForTimeout(100);assert.equal(held,true);
 await read('MSFT');await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'USD 400');release();await page.waitForTimeout(150);assert.equal(await page.getByTestId('research-price').innerText(),'USD 400');assert.equal(await page.locator('h1').innerText(),'MSFT');
 saveFails=true;await page.getByRole('button',{name:'Save security',exact:true}).click();await page.getByRole('alert').filter({hasText:'could not be saved'}).waitFor();assert.equal(await page.getByTestId('research-price').innerText(),'USD 400');saveFails=false;
 await page.getByRole('button',{name:'Save security',exact:true}).click();await page.getByRole('button',{name:'Save security',exact:true}).waitFor({state:'detached'});assert.equal(posts.length,2);assert.deepEqual(posts[1],{symbol:'MSFT',market:'US',companyName:'Fixture MSFT',saveOnly:true});
 await page.getByRole('button',{name:'Advanced tools',exact:true}).click();await page.getByText('Saved for later · no personal review',{exact:true}).waitFor();assert.ok((await page.getByRole('tab',{name:'Review',exact:true}).count())===1);
 await page.getByRole('tab',{name:'Review',exact:true}).click();await page.getByRole('heading',{name:'Your working note',exact:true}).waitFor();await noOverflow();
 // A late list read must not discard an explicit save completed in the meantime.
 list=[];listHold=true;await page.goto(`${base}/research-v8?ticker=AAPL&market=US`);await heading('Growth and positive earnings reported');await page.getByRole('button',{name:'Save security',exact:true}).click();await page.getByRole('button',{name:'Save security',exact:true}).waitFor({state:'detached'});releaseList();listHold=false;await page.waitForTimeout(150);assert.equal(await page.getByRole('button',{name:'Save security',exact:true}).count(),0);
 // Failed saved-list reads cannot block independent provider evidence.
 watchlistFails=true;await page.goto(`${base}/research-v8?ticker=5347&market=MY`);await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'MYR 200');
 await page.goto(`${base}/main-v8`);
 await page.getByLabel('Market',{exact:true}).selectOption('MY');
 await page.locator('[data-indicator="vix"]').filter({hasText:'US VIX (FX proxy unavailable)'}).waitFor();
 await page.locator('[data-indicator="vix"]').click();
 await page.getByRole('heading',{name:'US VIX (FX proxy unavailable)',exact:true}).waitFor();
 assert.ok((await page.getByText('Observation date unavailable',{exact:true}).count())>0);
 await noOverflow();await page.screenshot({path:`${out}/market-${width}.png`,fullPage:true});
 assert.deepEqual(errors,[]);report.push({width,passed:true,scenarios:['US unsaved','MY unsaved','partial','missing','ETF/bank/unknown unsupported with facts retained','mismatched response rejected','rapid selection/late response','save failure and explicit retry','no manufactured decision','saved-list failure independence','overflow and control geometry','Market fallback provenance and observation-date limitation'],formBoxes});await context.close();
 }
} finally {await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({dataMode:'Synthetic API fixtures; no live database writes or provider verification',results:report},null,2));}
console.log(`Unsaved Research browser QA passed at ${report.map(r=>r.width).join(', ')}px.`);
