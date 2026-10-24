import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { researchSnapshotFixture } from './harness/research-read-fixture.mjs';
const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Fixture QA is local only.');
const before = process.argv.includes('--before');
const out = `.tmp/research-reading/${before ? 'before' : 'after'}`;
await mkdir(out, { recursive: true });
const nullable = ['volume','ma50','ma200','ema20','ema50','sma200','averageVolume20','rsi14','macd','macdSignal','macdHistogram','atr14','atrPercent14','anchoredVwap','adx14','plusDi14','minusDi14','supertrend'];
const point = (time, close) => ({time,open:close,high:close,low:close,close,...Object.fromEntries(nullable.map(k=>[k,null])),supertrendDirection:null});
function fixture(symbol, market) {
    const result = structuredClone(researchSnapshotFixture), data = result.data;
    const now = new Date().toISOString();
    Object.assign(data,{symbol,market,fetchedAt:now});
    Object.assign(data.quote,{name:`Fixture ${symbol} company with a long readable name`,currency:market==='MY'?'MYR':'USD',price:200,dailyChangePercent:1.25,observedAt:'2026-10-16T20:00:00Z',instrumentType:'EQUITY',sharesOutstanding:null,classification:{source:'Yahoo Finance',instrumentType:'EQUITY',sector:'Technology',industry:'Software',retrievedAt:now}});
    data.chart.points=[point('2026-07-01',80),point('2026-09-01',100),point('2026-10-01',110),point('2026-10-16',120)];
    data.warnings=['Fixture: annual inputs unavailable.'];
    data.valuation={marketCap:null,priceEarnings:null,priceSales:null,freeCashFlowYieldPercent:null,netCash:-200,shareBasis:null,reportingPeriod:null,source:null};
    if(symbol==='FLAT')data.chart.points=[point('2026-10-01',100),point('2026-10-16',100)];
    if(symbol==='ONE')data.chart.points=[point('2026-10-16',100)];
    if(symbol==='EMPTY')data.chart.points=[];
    if(symbol==='NONAME')data.quote.name=null;
    if(symbol==='ETF'){data.quote.instrumentType='ETF';data.quote.classification.instrumentType='ETF';}
    return result;
}
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const report=[];
try {
    for(const width of [1440,768,390,320]) {
        const context=await browser.newContext({viewport:{width,height:width>900?1000:844},hasTouch:width<=390,serviceWorkers:'block',reducedMotion:'reduce'});
        const page=await context.newPage();const errors=[];let fail=false;let releaseSlow;
        page.on('pageerror',e=>errors.push(e.message));
        page.on('requestfailed',r=>{if(!/ERR_ABORTED/.test(r.failure()?.errorText||'')) errors.push(r.failure()?.errorText);});
        await context.route('**/api/**',async route=>{
            assert.equal(route.request().method(),'GET','No production or fixture mutation permitted.');
            const url=new URL(route.request().url());
            if(url.pathname==='/api/research/watchlist')return route.fulfill({json:{success:true,data:[],archivedSymbols:[]}});
            if(url.pathname.startsWith('/api/research/symbol/')) {
                const symbol=url.pathname.split('/').at(-1);
                if(symbol==='SLOW')await new Promise(resolve=>{releaseSlow=resolve;});
                return route.fulfill(fail?{status:503,json:{success:false,error:'Fixture request failed'}}:{json:fixture(symbol,url.searchParams.get('market'))}).catch(()=>{});
            }
            return route.fulfill({json:{success:true,data:[]}});
        });
        async function shot(name) {
            await page.evaluate(()=>document.fonts.ready);
            const geometry=await page.locator('main h1,main button,main [role="tab"],main output').evaluateAll(items=>items.filter(e=>e.getClientRects().length).map(e=>{
                // Inside a horizontal scroller (the mobile tab strip), the scroller is what must fit the viewport.
                let box=e;for(let a=e.parentElement;a;a=a.parentElement)if(/auto|scroll/.test(getComputedStyle(a).overflowX)){box=a;break;}
                const r=box.getBoundingClientRect();return {text:e.textContent?.slice(0,80),left:r.left,right:r.right};
            }));
            assert.ok(geometry.every(r=>r.left>=-1&&r.right<=width+1),`${name}: visible controls must not be clipped at ${width}`);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name}: horizontal overflow`);
            await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true});
            report.push({name,width,geometry});
        }
        await page.goto(`${base}/research-v8?ticker=AAPL&market=US`);
        await page.getByTestId('research-price').filter({hasText:'USD 200'}).waitFor();
        await shot('overview');
        const chart=page.getByRole('region',{name:'Price history',exact:true});
        if(!before) {
            await page.getByRole('heading',{level:1,name:'Fixture AAPL company with a long readable name',exact:true}).waitFor();
            assert.match(await page.getByTestId('selected-security-identity').innerText(),/US · AAPL/);
            const rangeChange=page.getByTestId('research-range-change');
            assert.match(await rangeChange.innerText(),/20%/);assert.match(await rangeChange.innerText(),/1 Sept? 2026/);
            const svg=chart.locator('svg');await svg.scrollIntoViewIfNeeded();
            const geometry=await svg.evaluate(el=>{const m=el.getScreenCTM();const a=new DOMPoint(innerWidth<=600?58:65,100).matrixTransform(m);const z=new DOMPoint(innerWidth<=600?360:715,100).matrixTransform(m);return {a:{x:a.x,y:a.y},z:{x:z.x,y:z.y}};});
            if(width<=390)await page.touchscreen.tap(geometry.a.x,geometry.a.y);else await page.mouse.click(geometry.a.x,geometry.a.y);
            assert.match(await chart.locator('output').innerText(),/1 Sept? 2026.*100/);
            await page.mouse.click(geometry.z.x,geometry.z.y);assert.match(await chart.locator('output').innerText(),/16 Oct 2026.*120/);
            const scrubber=chart.getByRole('slider');await scrubber.focus();await scrubber.press('Home');assert.match(await chart.locator('output').innerText(),/1 Sept? 2026/);
            await scrubber.press('End');assert.match(await chart.locator('output').innerText(),/16 Oct 2026/);
            await chart.getByRole('button',{name:'1M',exact:true}).click();assert.match(await rangeChange.innerText(),/9.09%/);
            await chart.getByRole('button',{name:'All',exact:true}).click();assert.match(await rangeChange.innerText(),/50%/);
            assert.match(await page.getByRole('region',{name:'Current provider quote'}).innerText(),/Daily change[\s\S]*\+1\.25%/);
            await shot('chart');
        }
        await page.getByRole('tab',{name:'Valuation',exact:true}).click();await shot('valuation-us');
        if(!before){await page.getByRole('region',{name:'Valuation availability'}).getByText('Why these values are unavailable',{exact:true}).click();assert.match(await page.getByRole('region',{name:'Valuation availability'}).innerText(),/outstanding shares/i);}
        await page.goto(`${base}/research-v8?ticker=5347&market=MY&tab=valuation`);await page.getByTestId('research-price').filter({hasText:'MYR 200'}).waitFor();await shot('valuation-my');
        if(!before){await page.getByRole('region',{name:'Valuation availability'}).getByText('Why these values are unavailable',{exact:true}).click();assert.match(await page.getByRole('region',{name:'Valuation availability'}).innerText(),/diluted average shares are not substituted/i);}
        if(!before){
            for(const symbol of ['FLAT','ONE','EMPTY','NONAME','ETF']) {
                await page.goto(`${base}/research-v8?ticker=${symbol}&market=US`);await page.getByTestId('research-price').filter({hasText:'USD 200'}).waitFor();
                if(symbol==='FLAT')assert.match(await page.getByTestId('research-range-change').innerText(),/0%/);
                if(symbol==='ONE') {assert.match(await page.getByTestId('research-range-change').innerText(),/One observation/);assert.equal(await chart.getByRole('slider').isDisabled(),true);}
                if(symbol==='EMPTY') {assert.equal(await chart.locator('svg').count(),0);assert.match(await chart.innerText(),/No price history returned/);}
                if(symbol==='NONAME')await page.getByRole('heading',{level:1,name:'NONAME',exact:true}).waitFor();
                if(symbol==='ETF')await page.getByRole('region',{name:'Financial assessment status'}).getByText('Assessment unsupported',{exact:true}).waitFor();
            }
            fail=true;await page.getByRole('button',{name:'Refresh provider data',exact:true}).click();await page.getByRole('button',{name:'Retry provider data',exact:true}).waitFor();assert.match(await page.getByRole('region',{name:'Provider data status'}).innerText(),/Previous values/);fail=false;
            await page.goto(`${base}/research-v8?ticker=SLOW&market=US`);await page.getByRole('heading',{level:1,name:'SLOW',exact:true}).waitFor();
            for(let i=0;i<100&&!releaseSlow;i++)await page.waitForTimeout(20);
            assert.equal(typeof releaseSlow,'function');
            await page.getByText('Change security',{exact:true}).click();await page.getByLabel('Company or ticker',{exact:true}).fill('MSFT');await page.getByRole('button',{name:'Read ticker directly',exact:true}).click();
            await page.getByRole('heading',{level:1,name:'Fixture MSFT company with a long readable name',exact:true}).waitFor();releaseSlow();await page.waitForTimeout(100);
            assert.equal(await page.getByRole('heading',{level:1}).innerText(),'Fixture MSFT company with a long readable name');
        }
        assert.deepEqual(errors,[]);await context.close();
    }
} finally {await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({fixtureOnly:true,before,report},null,2));}
console.log(`Research reading ${before?'baseline captures':'checks passed'}: ${report.length} captured states.`);
