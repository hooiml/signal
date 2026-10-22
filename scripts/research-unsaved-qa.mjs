import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';
import { guestWorkspaceQa } from './guest-workspace-qa.mjs';
const base=process.env.SIGNAL_QA_URL||'http://127.0.0.1:3101';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname),'Fixture QA requires localhost');
const out='.tmp/current-assessment/browser';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const report=[];
const fixture=researchReadFixture(); const saved=(await (await fixture.route.GET()).json()).data[0];
function snapshot(symbol,market) {
 const r=structuredClone(researchSnapshotFixture);
 Object.assign(r.data,{symbol,market,fetchedAt:new Date().toISOString()});
 Object.assign(r.data.quote,{name:symbol==='MAYBANK'?'Malayan Banking Berhad':`Fixture ${symbol}`,price:symbol==='MSFT'?400:200,currency:market==='MY'?'MYR':'USD',instrumentType:symbol==='VOO'?'ETF':'EQUITY',observedAt:'2026-10-02T20:00:00.000Z'});
 r.data.quote.classification={source:'Yahoo Finance',instrumentType:r.data.quote.instrumentType==='ETF'?'ETF':'EQUITY',sector:symbol==='MAYBANK'?'Financial Services':'Technology',industry:symbol==='MAYBANK'?'Banks—Regional':'Consumer Electronics',retrievedAt:new Date().toISOString()};
 Object.assign(r.data.fundamentals,{source:market==='MY'?'Yahoo Finance':'SEC EDGAR',reportingPeriod:'2025-12-31',revenueGrowthPercent:10,annualRevenue:1000,annualNetIncome:100,freeCashFlow:80});
 const currentPeriod={...r.data.fundamentals,currency:market==='MY'?'MYR':'USD'};
 r.data.fundamentals.history=[currentPeriod,{...currentPeriod,reportingPeriod:'2024-12-31',annualRevenue:900,annualNetIncome:90,freeCashFlow:100}];
 if(symbol==='BIG'){r.data.fundamentals.annualRevenue=1234567890;r.data.fundamentals.history[0].annualRevenue=1234567890;}
 r.data.warnings=[];
 if(market==='MY'&&!r.data.quote.sharesOutstanding)Object.assign(r.data.valuation,{marketCap:null,priceEarnings:null,priceSales:null,freeCashFlowYieldPercent:null});
 if(symbol==='PARTIAL'){r.data.fundamentals.freeCashFlow=null;r.data.warnings=['Fixture cash flow unavailable'];}
 if(symbol==='MISSING'){for(const key of ['revenueGrowthPercent','annualNetIncome','freeCashFlow'])r.data.fundamentals[key]=null;}
 if(symbol==='OLD')r.data.fundamentals.reportingPeriod='2020-12-31';
 if(symbol==='UNKNOWN')r.data.quote.instrumentType=null;
 if(symbol==='WRONG')r.data.symbol='AAPL';
 return r;
}
try {
 if(process.env.SIGNAL_QA_SKIP_GUEST!=='1')await guestWorkspaceQa(browser,base,snapshot,{...structuredClone(saved),symbol:'AAPL',market:'US',companyName:'Private owner Apple',notes:'PRIVATE_OWNER_ONLY'});
 for(const width of [1440,1280,768,390,375]){
 const context=await browser.newContext({viewport:{width,height:width<=390?844:1000},serviceWorkers:'block'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!/status of (500|502|503)/.test(m.text()))errors.push(m.text());});
 page.on('requestfailed',r=>{if(!/ERR_ABORTED/.test(r.failure()?.errorText??''))errors.push(r.failure()?.errorText);});
 const posts=[];const providerReads=[];let list=[];let release;let held;let watchlistFails=false;let saveFails=false;let listHold;let releaseList;let revisedIncome=false;let providerFails=false;let marketScoreCase='normal';let searchFails=false;let searchHold=false;let releaseSearch;const searches=[];
 await context.route('**/api/**',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.pathname==='/api/owner/session')return route.fulfill({json:{success:true,data:{configured:true,unlocked:true}}});
  if(u.pathname==='/api/signals/v2'){const f=marketRequestFixture({providerReadings:{putCallRatio:{ratio:0.8,reportDate:'2026-09-11',retrievedAt:'2026-09-12T00:00:00Z',source:'cboe-daily-market-statistics',sourceUrl:'https://example.test/cboe'},naaimExposure:{exposure:60,reportDate:'2026-09-09',retrievedAt:'2026-09-12T00:00:00Z',source:'naaim-exposure-index',sourceUrl:'https://example.test/naaim'}},previousSnapshot:{snapshot_date:'2026-09-11',composite_score:45,tier:'neutral',components:{vix:{display_name:'VIX Index',score:45,weight:1}},score_drivers:[],origin:'observed',coverage_note:null}});const response=await f.route.GET(f.request(u.search.slice(1)));const payload=await response.json();if(marketScoreCase==='unchanged')payload.data.metadata.score_delta.delta=0;if(marketScoreCase==='missing')delete payload.data.metadata.score_delta;return route.fulfill({json:payload});}
  if(u.pathname.startsWith('/api/signals/'))return route.fulfill({status:503,json:{success:false,error:'Fixture archive unavailable'}});
  if(u.pathname==='/api/research/search') {
   const q=u.searchParams.get('q'),market=u.searchParams.get('market');searches.push({q,market});
   if(searchHold)await new Promise(resolve=>{releaseSearch=resolve;});
   if(searchFails)return route.fulfill({status:502,json:{success:false,error:'Fixture search unavailable'}});
   const rows=q==='No results'?[]:market==='MY'?[{symbol:'5347.KL',name:'Tenaga Nasional Berhad',market:'MY',exchange:'Kuala Lumpur Stock Exchange',instrumentType:'EQUITY',sector:'Utilities',industry:'Utilities—Regulated Electric'}]:[{symbol:'AAPL',name:'Apple Inc.',market:'US',exchange:'NASDAQ',instrumentType:'EQUITY',sector:'Technology',industry:'Consumer Electronics'},{symbol:'AAPX',name:'Apple leveraged ETF',market:'US',exchange:'BATS Trading',instrumentType:'ETF',sector:null,industry:null}];
   return route.fulfill({json:{success:true,data:rows}}).catch(()=>{});
  }
  if(u.pathname==='/api/research/watchlist') {
   if(req.method()==='POST') {const body=req.postDataJSON();posts.push(body);if(saveFails)return route.fulfill({status:500,json:{success:false,error:'fixture save failure'}});const record={...structuredClone(saved),symbol:body.symbol,market:body.market,companyName:body.companyName,thesisStrength:'unknown',whyInterested:'',notes:'',decisionJournal:{...saved.decisionJournal,decision:'Not recorded',confidence:'unrecorded'},reviewHistory:[]};list=[record];return route.fulfill({status:201,json:{success:true,data:record}});}
   const capturedList=structuredClone(list);if(listHold)await new Promise(resolve=>{releaseList=resolve;});
   return route.fulfill({status:watchlistFails?500:200,json:{success:!watchlistFails,data:capturedList,archivedSymbols:[]}});
  }
  if(u.pathname.includes('/api/research/symbol/')) {
   const symbol=decodeURIComponent(u.pathname.split('/').at(-1));providerReads.push({symbol,market:u.searchParams.get('market')});
   if(symbol==='SLOW') { held=true;await new Promise(r=>{release=r;}); }
   if(providerFails)return route.fulfill({status:503,json:{success:false,error:'Fixture provider unavailable'}});
   const result=snapshot(symbol,u.searchParams.get('market'));if(revisedIncome)result.data.fundamentals.annualNetIncome=150;
   return route.fulfill({json:result}).catch(()=>{});
  }
  assert.equal(req.method(),'GET','No unexpected mutation');return route.fulfill({json:{success:true,data:[]}});
 });
 async function openLookup(){const disclosure=page.locator('details').filter({has:page.getByText('Change security',{exact:true})});if(await disclosure.count()&&!(await disclosure.getAttribute('open')!==null))await disclosure.locator(':scope > summary').click();}
 async function read(symbol,market='US') {await openLookup();await page.getByLabel('Company or ticker',{exact:true}).fill(symbol);await page.getByLabel('Lookup market',{exact:true}).selectOption(market);await page.getByRole('button',{name:'Read ticker directly',exact:true}).click();}
 async function heading(text){
  if(text==='Growth and positive earnings reported') {
   // Wait for provider data and URL restoration before choosing the tab-specific assertion.
   await page.getByRole('region',{name:'Financial assessment status',exact:true}).getByText('3 of 3 financial inputs',{exact:true}).waitFor();
   if(await page.getByRole('tab',{name:'Overview',exact:true}).getAttribute('aria-selected')!=='true') return;
  }
  const compactStatus=text==='Assessment not supported for this security'?'Assessment unsupported':text==='Not enough financial data'?'Insufficient evidence':null;
  if(!compactStatus){await page.getByRole('heading',{name:text,exact:true}).waitFor();return;}
  await page.getByRole('region',{name:'Financial assessment status',exact:true}).getByText(compactStatus,{exact:true}).waitFor();
  await page.getByRole('region',{name:'Current research assessment',exact:true}).locator('summary').filter({hasText:'Assessment evidence and limitations'}).click();
 }
 async function noOverflow(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow ${width}`);}
 await page.goto(`${base}/research-v8?ticker=AAPL&market=US`);
 await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'USD 200.00');assert.equal(posts.length,0);
 // Name search never navigates or saves until a result is explicitly selected.
 const searchInput=page.getByLabel('Company or ticker',{exact:true});
 const find=()=>page.getByRole('button',{name:'Find security',exact:true}).click();
 await openLookup();await searchInput.fill('Apple');assert.equal(searches.length,0);await find();
 const results=page.getByRole('list',{name:'Security search results'});await results.getByRole('button',{name:/Apple Inc/}).waitFor();
 assert.equal(await page.locator('h1').innerText(),'Fixture AAPL');assert.equal(posts.length,0);
 await noOverflow();await page.screenshot({path:`${out}/lookup-${width}.png`,fullPage:true});
 await results.getByRole('button',{name:/Apple Inc/}).focus();await page.keyboard.press('Enter');await heading('Growth and positive earnings reported');assert.equal(await results.count(),0);
 await searchInput.fill('Tenaga');await page.getByLabel('Lookup market',{exact:true}).selectOption('MY');await find();await results.getByRole('button',{name:/Tenaga/}).click();await heading('Growth and positive earnings reported');assert.equal(await page.locator('h1').innerText(),'Fixture 5347.KL');assert.equal(await page.getByTestId('research-price').innerText(),'MYR 200.00');assert.equal(posts.length,0);
 await searchInput.fill('No results');await find();await page.getByText(/No supported listings found/).waitFor();assert.equal(await page.locator('h1').innerText(),'Fixture 5347.KL');
 searchFails=true;await searchInput.fill('Apple');await page.getByLabel('Lookup market',{exact:true}).selectOption('US');await find();await page.getByRole('alert').filter({hasText:'Security search is unavailable'}).waitFor();searchFails=false;await find();await results.getByRole('button',{name:/Apple Inc/}).waitFor();
 // A late search must not replace a new query/market or direct selection.
 searchHold=true;await searchInput.fill('Apple');await find();await page.waitForFunction(()=>document.querySelector('button[type="submit"]')?.textContent==='Searching…');await page.waitForTimeout(100);
 await searchInput.fill('5347');await page.getByLabel('Lookup market',{exact:true}).selectOption('MY');await page.getByRole('button',{name:'Read ticker directly',exact:true}).click();await heading('Growth and positive earnings reported');searchHold=false;releaseSearch();await page.waitForTimeout(150);assert.equal(await results.count(),0);assert.equal(await page.locator('h1').innerText(),'Fixture 5347');
 await read('AAPL');await heading('Growth and positive earnings reported');
 await read('BIG');await heading('Growth and positive earnings reported');
 await page.getByText('USD 1.23 billion',{exact:true}).waitFor();
 const exactRevenue=page.locator('details').filter({has:page.locator('summary').filter({hasText:'Exact amount, comparison and source'})}).first();
 await exactRevenue.locator('summary').click();await exactRevenue.getByText(/Annual revenue: USD 1,234,567,890/).waitFor();
 await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/research-format-overview-${width}.png`,fullPage:true});
 await page.getByRole('tab',{name:'Financials',exact:true}).click();
 await page.getByText(/SEC EDGAR · Year ended 31 Dec 2025/).waitFor();
 await page.getByText('USD 1.23 billion',{exact:true}).waitFor();
 await noOverflow();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/research-format-financials-${width}.png`,fullPage:true});
 await page.getByRole('tab',{name:'Overview',exact:true}).click();await read('AAPL');await heading('Growth and positive earnings reported');
 await noOverflow();await page.screenshot({path:`${out}/research-${width}.png`,fullPage:true});
 const formBoxes=await page.getByRole('form',{name:'Security lookup'}).locator('input,select,button').evaluateAll(nodes=>nodes.map(node=>{const b=node.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}}));
 for(let i=0;i<formBoxes.length;i++)for(let j=i+1;j<formBoxes.length;j++){const a=formBoxes[i],b=formBoxes[j];assert.ok(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,'Lookup controls overlap');}
 const assessment=page.getByRole('region',{name:'Current research assessment',exact:true});
 await page.getByRole('region',{name:'Financial assessment status',exact:true}).getByText('3 of 3 financial inputs',{exact:true}).waitFor();
 await assessment.getByText(/Reading limits:/).waitFor();
 const reportedFacts=assessment.locator('dl').filter({hasText:'Annual free cash flow'});
 await reportedFacts.getByText('USD 80',{exact:true}).waitFor();
 await reportedFacts.getByText(/down 20\.0% vs year ended/).waitFor();
 assert.equal(await assessment.getByText(/No new financial evidence/).count(),0);
 await page.getByRole('button',{name:'Refresh provider data',exact:true}).click();
 await assessment.getByText(/No new financial evidence returned/).waitFor();
 revisedIncome=true;await page.getByRole('button',{name:'Refresh provider data',exact:true}).click();
 await assessment.getByText(/Financial summary inputs changed/).waitFor();await heading('Growth and positive earnings reported');
 providerFails=true;await page.getByRole('button',{name:'Refresh provider data',exact:true}).click();
 await heading('Provider refresh failed · assessment limited');assert.equal(await assessment.getByText(/Financial summary inputs changed/).count(),0);assert.equal(await page.getByTestId('research-price').innerText(),'USD 200.00');
 providerFails=false;revisedIncome=false;await page.getByRole('button',{name:'Retry provider data',exact:true}).click();await heading('Growth and positive earnings reported');
 const geometry=await assessment.locator('h2,h3,button,summary,p,li').evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const r=n.getBoundingClientRect();return {text:n.textContent.slice(0,45),left:r.left,right:r.right,width:r.width};}));
 assert.ok(geometry.every(r=>r.left>=-1&&r.right<=width+1),'Assessment content outside viewport');
 await read('5347','MY');await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'MYR 200.00');assert.equal(posts.length,0);await page.getByRole('tab',{name:'Financials',exact:true}).click();await page.locator('dd').filter({hasText:/^MYR 1,000$/}).waitFor();
 const revenueRow=page.locator('dt').filter({hasText:/^Annual revenue$/}).locator('..');
 if(width<=600){
  const boxes=await revenueRow.locator(':scope > dt, :scope > dd').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,bottom:r.bottom,width:r.width,align:getComputedStyle(n).textAlign};}));
  assert.equal(boxes.length,3);assert.ok(boxes[1].y>=boxes[0].bottom&&boxes[2].y>=boxes[1].bottom,'Mobile financial label, amount and explanation stack without overlap');
  assert.ok(boxes.every(b=>Math.abs(b.x-boxes[0].x)<1&&b.width>250),'Financial explanations use the available mobile width');
  assert.ok(boxes.slice(1).every(b=>b.align==='left'));
 }
 await revenueRow.scrollIntoViewIfNeeded();await noOverflow();await page.screenshot({path:`${out}/financial-reading-${width}.png`});
 await page.getByRole('tab',{name:'Valuation',exact:true}).click();await page.getByRole('heading',{name:'Price, value and downside'}).waitFor();
 await page.locator('dt').filter({hasText:/^Market capitalization/}).locator('small').filter({hasText:/compatible outstanding shares are unavailable; annual diluted average shares are not substituted/}).waitFor();
 await page.locator('dt').filter({hasText:/^Price \/ earnings/}).locator('small').filter({hasText:/Price paid for each unit of reported annual profit\.[\s\S]*Unavailable because market capitalization is unavailable because compatible outstanding shares are unavailable/}).waitFor();
 await read('PARTIAL');await heading('Partial financial picture');assert.equal(await page.getByTestId('research-price').innerText(),'USD 200.00');
 await read('MISSING');await heading('Not enough financial data');await page.getByRole('region',{name:'Financial assessment status',exact:true}).getByText('Insufficient evidence',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Refresh provider data',exact:true}).click();await assessment.getByText(/Insufficient financial evidence returned/).waitFor();assert.equal(await assessment.getByText(/No new financial evidence/).count(),0);
 await read('OLD');await heading('Older data · assessment limited');await page.getByRole('region',{name:'Financial assessment status',exact:true}).getByText('Data needs updating',{exact:true}).waitFor();
 for(const symbol of ['VOO','MAYBANK','UNKNOWN']){await read(symbol,symbol==='MAYBANK'?'MY':'US');await heading('Assessment not supported for this security');assert.match(await page.getByTestId('research-price').innerText(),/200/);await page.getByRole('tab',{name:'Financials',exact:true}).click();await page.getByRole('heading',{name:'Business performance'}).waitFor();}
 await read('WRONG');await heading('Provider refresh failed · assessment limited');assert.equal(await page.getByTestId('research-price').innerText(),'Unavailable');
 await read('SLOW');await page.waitForFunction(()=>document.querySelector('h1')?.textContent==='SLOW');assert.equal(await page.getByTestId('research-price').innerText(),'Loading…');await page.waitForTimeout(100);assert.equal(held,true);
 await read('MSFT');await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'USD 400.00');release();await page.waitForTimeout(150);assert.equal(await page.getByTestId('research-price').innerText(),'USD 400.00');assert.equal(await page.locator('h1').innerText(),'Fixture MSFT');
 saveFails=true;await page.getByRole('button',{name:'Save security',exact:true}).click();await page.getByRole('alert').filter({hasText:'could not be saved'}).waitFor();assert.equal(await page.getByTestId('research-price').innerText(),'USD 400.00');saveFails=false;
 await page.getByRole('button',{name:'Save security',exact:true}).click();await page.getByRole('button',{name:'Save security',exact:true}).waitFor({state:'detached'});assert.equal(posts.length,2);assert.deepEqual(posts[1],{symbol:'MSFT',market:'US',companyName:'Fixture MSFT',saveOnly:true});
 await page.getByRole('button',{name:'Saved research',exact:true}).click();await page.getByRole('button',{name:'Advanced tools',exact:true}).click();await page.getByText('No personal review recorded.',{exact:true}).waitFor();assert.ok((await page.getByRole('tab',{name:'Review',exact:true}).count())===1);
 await page.getByRole('tab',{name:'Review',exact:true}).click();await page.getByRole('heading',{name:'Your working note',exact:true}).waitFor();await noOverflow();
 // A late list read must not discard an explicit save completed in the meantime.
 list=[];listHold=true;await page.goto(`${base}/research-v8?ticker=AAPL&market=US`);await heading('Growth and positive earnings reported');await page.getByRole('button',{name:'Save security',exact:true}).click();await page.getByRole('button',{name:'Save security',exact:true}).waitFor({state:'detached'});releaseList();listHold=false;await page.waitForTimeout(150);assert.equal(await page.getByRole('button',{name:'Save security',exact:true}).count(),0);
 // Failed saved-list reads cannot block independent provider evidence.
 watchlistFails=true;await page.goto(`${base}/research-v8?ticker=5347&market=MY`);await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'MYR 200.00');const savedWarning=page.getByText(/Saved research could not be refreshed/);await savedWarning.waitFor();watchlistFails=false;await savedWarning.getByRole('button',{name:'Retry saved research',exact:true}).click();await savedWarning.waitFor({state:'detached'});watchlistFails=true;
 // Legacy links must resolve an exact saved market before any provider request.
 const legacyRecord=(symbol,market)=>({...structuredClone(saved),symbol,market,companyName:`Saved ${symbol}`});
 const unresolved=page.getByRole('region',{name:'Resolve security market',exact:true});
 async function holdLegacy(symbol,records) {
  watchlistFails=false;list=records;listHold=true;releaseList=undefined;providerReads.length=0;
  await page.goto(`${base}/research-v8?ticker=${symbol}&tab=financials&source=legacy`);
  await unresolved.getByRole('heading',{name:'Resolving saved security market…',exact:true}).waitFor();
  for(let tries=0;!releaseList&&tries<100;tries++)await page.waitForTimeout(20);
  assert.equal(typeof releaseList,'function','Saved-list request must be pending');
  assert.deepEqual(providerReads,[],'Ambiguous legacy links must not guess US while saved records load');
 }
 await holdLegacy('CIMB',[legacyRecord('CIMB','MY')]);await noOverflow();await page.screenshot({path:`${out}/legacy-pending-${width}.png`,fullPage:true});
 listHold=false;releaseList();await heading('Growth and positive earnings reported');
 assert.deepEqual(providerReads,[{symbol:'CIMB',market:'MY'}]);assert.equal(await page.getByTestId('research-price').innerText(),'MYR 200.00');
 assert.equal(new URL(page.url()).searchParams.get('market'),'MY');assert.equal(new URL(page.url()).searchParams.get('source'),'legacy');
 assert.equal(await page.getByRole('tab',{name:'Financials',exact:true}).getAttribute('aria-selected'),'true');
 // Canonicalized legacy URLs preserve the resolved market even when a later reload fails.
 watchlistFails=true;providerReads.length=0;await page.reload();await heading('Growth and positive earnings reported');
 assert.deepEqual(providerReads,[{symbol:'CIMB',market:'MY'}]);
 await holdLegacy('AAPL',[legacyRecord('AAPL','US')]);listHold=false;releaseList();await heading('Growth and positive earnings reported');assert.deepEqual(providerReads,[{symbol:'AAPL',market:'US'}]);
 // Failed and empty saved-list reads both leave an ambiguous ticker unresolved.
 for(const fail of [true,false]) {
  watchlistFails=fail;list=[];providerReads.length=0;
  await page.goto(`${base}/research-v8?ticker=CIMB`);await unresolved.getByRole('heading',{name:'Choose this security’s market',exact:true}).waitFor();
  assert.deepEqual(providerReads,[]);assert.equal(await page.getByTestId('research-price').count(),0);
  await noOverflow();if(fail)await page.screenshot({path:`${out}/legacy-market-choice-${width}.png`,fullPage:true});
  const chosenMarket=fail?'MY':'US';await unresolved.getByRole('button',{name:fail?'Read CIMB in Malaysia':'Read CIMB in US',exact:true}).click();
  await heading('Growth and positive earnings reported');assert.deepEqual(providerReads,[{symbol:'CIMB',market:chosenMarket}]);assert.equal(new URL(page.url()).searchParams.get('market'),chosenMarket);
 }
 // Explicit links start immediately and cannot be overwritten by a conflicting saved market.
 watchlistFails=false;list=[legacyRecord('CIMB','MY')];listHold=true;releaseList=undefined;providerReads.length=0;
 await page.goto(`${base}/research-v8?ticker=CIMB&market=US`);await heading('Growth and positive earnings reported');
 assert.deepEqual(providerReads,[{symbol:'CIMB',market:'US'}]);assert.equal(typeof releaseList,'function');
 listHold=false;releaseList();await page.waitForTimeout(150);assert.deepEqual(providerReads,[{symbol:'CIMB',market:'US'}]);assert.equal(new URL(page.url()).searchParams.get('market'),'US');assert.equal(await page.locator('h1').innerText(),'Fixture CIMB');
 // A delayed saved response must resolve the current selection, not an older deep link.
 await holdLegacy('CIMB',[legacyRecord('CIMB','MY')]);await read('MSFT','US');await heading('Growth and positive earnings reported');
 listHold=false;releaseList();await page.waitForTimeout(150);assert.equal(await page.locator('h1').innerText(),'Fixture MSFT');assert.deepEqual(providerReads,[{symbol:'MSFT',market:'US'}]);
 await page.goBack();await page.getByRole('heading',{name:'Saved CIMB',exact:true}).waitFor();await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'MYR 200.00');assert.equal(new URL(page.url()).searchParams.get('market'),'MY');
 watchlistFails=true;providerReads.length=0;await page.reload();await heading('Growth and positive earnings reported');assert.deepEqual(providerReads,[{symbol:'CIMB',market:'MY'}]);
 await page.goForward();await page.getByRole('heading',{name:'Fixture MSFT',exact:true}).waitFor();await heading('Growth and positive earnings reported');assert.equal(await page.getByTestId('research-price').innerText(),'USD 400.00');
 // Unambiguous Malaysian ticker forms retain independent reads during a list failure.
 watchlistFails=true;
 for(const symbol of ['5347','5347.KL','MAYBANK','KLCI']) {
  providerReads.length=0;await page.goto(`${base}/research-v8?ticker=${symbol}`);await page.getByTestId('research-price').filter({hasText:'MYR 200'}).waitFor();assert.deepEqual(providerReads,[{symbol,market:'MY'}]);
 }
 await page.goto(`${base}/main-v8`);
 await page.getByTestId('connected-score').waitFor();
 for(const theme of ['light','dark']) {
  await page.getByRole('combobox',{name:'Colour theme'}).selectOption(theme);
  await page.waitForFunction(value=>document.documentElement.dataset.v8Theme===value,theme);
  const coverage=page.getByRole('img',{name:/^Score weight:/}).locator('..');
  const colours=await coverage.evaluate(node=>Array.from(node.querySelectorAll('circle[data-indicator]')).map(circle=>({key:circle.dataset.indicator,colour:getComputedStyle(circle).stroke,legend:getComputedStyle(node.querySelector(`i[data-indicator="${circle.dataset.indicator}"]`)).backgroundColor})));
  assert.ok(colours.length>=3,'Multiple inputs and fallback must render');
  assert.equal(new Set(colours.map(c=>c.colour)).size,colours.length,'Each included indicator and fallback has a distinct colour');
  assert.ok(colours.every(c=>c.colour===c.legend),'Ring and legend identity colours match');
  for(const marker of await page.getByRole('group',{name:'Leading evidence'}).locator('i[data-indicator]').all()) {
   const indicator=await marker.getAttribute('data-indicator');
   assert.equal(await marker.evaluate(node=>getComputedStyle(node).backgroundColor),colours.find(c=>c.key===indicator)?.colour);
  }
  assert.match(await coverage.innerText(),/fresh|stale|unverified/,'Freshness stays explicit in text');
  await noOverflow();await page.screenshot({path:`${out}/market-colours-${theme}-${width}.png`});
  await coverage.screenshot({path:`${out}/market-ring-${theme}-${width}.png`});
 }
 await page.getByRole('combobox',{name:'Colour theme'}).selectOption('light');
 await page.getByText('How to read this assessment · methodology and limits',{exact:true}).click();
 await page.getByRole('region',{name:'Current market assessment',exact:true}).waitFor();
 marketScoreCase='unchanged';await page.getByRole('button',{name:'Reload data',exact:true}).click();await page.getByTestId('market-comparison').filter({hasText:/Score unchanged.*Individual inputs can still differ/}).waitFor();await page.getByTestId('market-hero-unchanged').filter({hasText:/^No change since /}).waitFor();assert.equal(await page.getByRole('region',{name:'Market assessment'}).getByRole('button',{name:/points vs/}).count(),0);
 marketScoreCase='missing';await page.getByRole('button',{name:'Reload data',exact:true}).click();await page.getByTestId('market-comparison').filter({hasText:/No earlier comparable score supplied/}).waitFor();
 marketScoreCase='normal';await page.getByLabel('Market',{exact:true}).selectOption('MY');
 await page.locator('[data-indicator="vix"]').filter({hasText:'US VIX (FX proxy unavailable)'}).waitFor();
 const eligibilityNotice=page.getByText(/MY news eligibility version: previous unknown, current 1/);
 await eligibilityNotice.waitFor();await eligibilityNotice.scrollIntoViewIfNeeded();await noOverflow();
 if(width<=600){
  const driver=page.getByRole('region',{name:'Driver changes',exact:true}).getByRole('button').first();
  const labelBox=await driver.locator(':scope > span').first().boundingBox();const amountBox=await driver.locator('b').boundingBox();
  assert.ok(labelBox.width>250&&amountBox.y>=labelBox.y+labelBox.height,'Mobile contributor label has a full readable row above its delta');
 }
 await page.screenshot({path:`${out}/market-comparison-limits-${width}.png`});
 await page.getByText('How to read this assessment · methodology and limits',{exact:true}).click();
 const marketAssessment=page.getByRole('region',{name:'Current market assessment',exact:true});
 await marketAssessment.getByRole('heading',{name:'What this reading means'}).waitFor();
 await marketAssessment.getByText(/Reading limits:/).waitFor();
 await marketAssessment.getByText(/In Momentum mode, higher scores support positive momentum/).waitFor();
 await page.getByRole('button',{name:'Advanced tools',exact:true}).click();
 for(const mode of ['Contrarian','Momentum','Contrarian','Momentum']) {
  await page.getByRole('button',{name:mode,exact:true}).click();
  await page.getByTestId('connected-score').waitFor();
  await page.getByText('How to read this assessment · methodology and limits',{exact:true}).click();
  await marketAssessment.getByText(mode==='Contrarian'?/In Contrarian mode, higher scores indicate crowding or greed risk/:/In Momentum mode, higher scores support positive momentum/).waitFor();
  if(mode==='Contrarian'){await noOverflow();await page.screenshot({path:`${out}/market-contrarian-${width}.png`,fullPage:true});}
 }
 await page.getByRole('button',{name:'Back to basic view',exact:true}).click();
 const leadingEvidence=page.getByRole('group',{name:'Leading evidence',exact:true});
 await leadingEvidence.getByText(/alignment compares its category with the overall reading/).waitFor();
 const evidenceBoxes=await leadingEvidence.locator('button').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
 assert.ok(evidenceBoxes.length>0&&evidenceBoxes.every(r=>r.height>=44&&r.x>=-1&&r.x+r.width<=width+1),'Market evidence buttons must fit and be touch-sized');
 await noOverflow();await page.screenshot({path:`${out}/market-summary-${width}.png`,fullPage:true});
 await leadingEvidence.getByRole('button').first().focus();await page.keyboard.press('Enter');

 await page.getByRole('heading',{name:'US VIX (FX proxy unavailable)',exact:true}).waitFor();
 assert.ok((await page.getByText('Observation date unavailable',{exact:true}).count())>0);
 await noOverflow();await page.screenshot({path:`${out}/market-${width}.png`,fullPage:true});
 assert.deepEqual(errors,[]);report.push({width,passed:true,scenarios:['financial refresh unchanged/changed/error/retry','visible limitations and evidence states','Market unchanged/unavailable score comparison and keyboard inspector','US unsaved','MY unsaved','partial','missing','ETF/bank/unknown unsupported with facts retained','mismatched response rejected','rapid selection/late response','save failure and explicit retry','no manufactured decision','saved-list failure independence','legacy MY/US deferred market resolution','failed/empty legacy links require market choice','explicit market beats conflicting saved record','late saved list preserves newer selection and Back/Forward','canonical legacy link reload failure','unambiguous MY legacy forms','overflow and control geometry','Market fallback provenance and observation-date limitation'],formBoxes});await context.close();
 }
} finally {await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({dataMode:'Synthetic API fixtures; no live database writes or provider verification',results:report},null,2));}
console.log(`Unsaved Research browser QA passed at ${report.map(r=>r.width).join(', ')}px.`);
