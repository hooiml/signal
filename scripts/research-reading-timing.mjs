import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { researchReadFixture, researchSnapshotFixture } from './harness/research-read-fixture.mjs';
await mkdir('.tmp/bounded-slice',{recursive:true});
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:['--no-sandbox']});
const phase=process.argv[2]||'before'; const port=process.argv[3]||'3100';
const results=[];
for(const symbol of ['AAPL','MSFT']) for(let i=0;i<3;i++) {
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const fixture=researchReadFixture();const watchlist=await (await fixture.route.GET()).json();let requested=false;
 const data=structuredClone(researchSnapshotFixture);Object.assign(data.data,{symbol,fetchedAt:new Date().toISOString()});
 Object.assign(data.data.quote,{instrumentType:'EQUITY',name:'Fixture '+symbol,observedAt:new Date().toISOString()});
 Object.assign(data.data.fundamentals,{source:'SEC EDGAR',reportingPeriod:'2025-12-31',annualNetIncome:100,annualRevenue:1000,revenueGrowthPercent:10,freeCashFlow:80});data.data.warnings=[];
 await context.route('**/api/**',async route=>{const u=new URL(route.request().url());if(u.pathname==='/api/research/watchlist'){await new Promise(r=>setTimeout(r,250));return route.fulfill({json:watchlist});}if(u.pathname.includes('/api/research/symbol/')){requested=true;await new Promise(r=>setTimeout(r,300));return route.fulfill({json:data});}return route.fulfill({json:{success:true,data:[]}});});
 const start=performance.now();await page.goto(`http://127.0.0.1:${port}/research-v8?ticker=${symbol}&market=US`,{waitUntil:'domcontentloaded'});
 await page.locator('h1').waitFor();const firstContentMs=performance.now()-start;
 let evidenceMs=null,assessmentMs=null;
 try { await page.getByTestId('research-price').filter({hasText:'USD 200'}).waitFor({timeout:3000});evidenceMs=performance.now()-start;await page.getByRole('heading',{name:'Growth and positive earnings reported'}).waitFor({timeout:2000});assessmentMs=performance.now()-start;}catch{}
 results.push({symbol,run:i+1,firstContentMs,evidenceMs,assessmentMs,providerRequested:requested,errors});
 await page.screenshot({path:`.tmp/bounded-slice/${phase}-${symbol}.png`}); await context.close();
}
await browser.close();await writeFile(`.tmp/bounded-slice/timing-${phase}.json`,JSON.stringify({phase,conditions:'Production build, Chromium, 1280x900, fresh browser contexts, fixed watchlist 250ms/provider 300ms fixtures, no network throttle, no live providers',results},null,2));console.log(JSON.stringify(results));
