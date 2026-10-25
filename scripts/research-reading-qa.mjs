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
    if(symbol==='ZERO')data.chart.points=[point('2026-10-01',0),point('2026-10-16',100)];
    if(symbol==='ONE')data.chart.points=[point('2026-10-16',100)];
    if(symbol==='EMPTY')data.chart.points=[];
    if(symbol==='NONAME')data.quote.name=null;
    if(symbol==='ETF'){data.quote.instrumentType='ETF';data.quote.classification.instrumentType='ETF';}
    return result;
}
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--no-sandbox']});
const report=[];
try {
    for(const width of [1280,768,375,320]) {
        const context=await browser.newContext({viewport:{width,height:width>900?1000:844},hasTouch:width<=375,colorScheme:'light',serviceWorkers:'block',reducedMotion:'reduce'});
        const page=await context.newPage();const errors=[];const apiRequests=[];let fail=false;let releaseSlow;
        page.on('pageerror',e=>errors.push(e.message));
        const expectedConsole=[];
        page.on('console',message=>{
            if(!['warning','error'].includes(message.type()))return;
            if(message.text()==='Service Worker registration blocked by Playwright'||(fail&&/503/.test(message.text())))expectedConsole.push(message.text());
            else errors.push(`${message.type()}: ${message.text()}`);
        });
        page.on('requestfailed',r=>{if(!/ERR_ABORTED/.test(r.failure()?.errorText||'')) errors.push(r.failure()?.errorText);});
        await context.route('**/api/**',async route=>{
            assert.equal(route.request().method(),'GET','No production or fixture mutation permitted.');
            const url=new URL(route.request().url());
            apiRequests.push(`${route.request().method()} ${url.pathname}${url.search}`);
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
        const chartPointsFor=async chartSvg=>{
            await chartSvg.scrollIntoViewIfNeeded();
            const coordinates=await chartSvg.evaluate(el=>{
                const matrix=el.getScreenCTM();if(!matrix)throw new Error('Chart geometry unavailable.');
                const mobile=innerWidth<=600, left=mobile?58:65, right=mobile?360:715;
                const point=value=>new DOMPoint(value,100).matrixTransform(matrix);
                const first=point(left),last=point(right);return {first:{x:first.x,y:first.y},last:{x:last.x,y:last.y}};
            });
            const targetIsChart=await chartSvg.evaluate((el,points)=>[points.first,points.last].every(point=>{
                const target=document.elementFromPoint(point.x,point.y);return target instanceof Element&&target.closest('svg')===el;
            }),coordinates);
            assert.ok(targetIsChart,'Measurement pointer coordinates must resolve to the visible chart SVG.');
            return coordinates;
        };
        try {
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
            if(width<=375)await page.touchscreen.tap(geometry.a.x,geometry.a.y);else await page.mouse.click(geometry.a.x,geometry.a.y);
            assert.match(await chart.locator('output').innerText(),/1 Sept? 2026.*100/);
            await page.mouse.click(geometry.z.x,geometry.z.y);assert.match(await chart.locator('output').innerText(),/16 Oct 2026.*120/);
            const scrubber=chart.getByRole('slider');await scrubber.focus();await scrubber.press('Home');assert.match(await chart.locator('output').innerText(),/1 Sept? 2026/);
            await scrubber.press('End');assert.match(await chart.locator('output').innerText(),/16 Oct 2026/);
            await chart.getByRole('button',{name:'1M',exact:true}).click();assert.match(await rangeChange.innerText(),/9.09%/);
            await chart.getByRole('button',{name:'All',exact:true}).click();assert.match(await rangeChange.innerText(),/50%/);
            const measure=chart.getByRole('button',{name:'Measure',exact:true});
            const measurement=page.getByTestId('research-measurement');
            const span=page.getByTestId('research-measurement-span');
            const measurementText=async source=>{await page.waitForFunction(pattern=>new RegExp(pattern).test(document.querySelector('[data-testid="research-measurement"]')?.textContent||''),source);return measurement.innerText();};
            const measurementGeometry=async name=>{
                const [selection, chartBox, status, result, clear]=await Promise.all([span.boundingBox(),svg.boundingBox(),measurement.boundingBox(),measurement.locator('strong').boundingBox(),measurement.getByRole('button',{name:'Clear measurement',exact:true}).boundingBox()]);
                assert.ok(selection&&chartBox&&selection.width>1&&selection.x>=chartBox.x-1&&selection.x+selection.width<=chartBox.x+chartBox.width+1,`${name}: selected span must be visible inside the chart`);
                assert.ok(status&&result&&clear&&result.x>=status.x-1&&result.x+result.width<=status.x+status.width+1&&clear.x>=status.x-1&&clear.x+clear.width<=status.x+status.width+1,`${name}: measurement result and clear control must remain inside the measurement panel`);
                assert.ok(result.x+result.width<=clear.x||clear.x+clear.width<=result.x||result.y+result.height<=clear.y||clear.y+clear.height<=result.y,`${name}: measurement result and clear control must not overlap`);
            };
            const chartPoints=()=>chartPointsFor(svg);
            assert.equal(await measure.getAttribute('aria-pressed'),'false');
            assert.match(await chart.getByText(/tap or click.*first.*second|drag.*measure/i).innerText(),/measure/i,'The chart explains how to make a measurement.');
            const requestsBeforeMeasurement=apiRequests.length;
            await measure.click();assert.equal(await measure.getAttribute('aria-pressed'),'true');
            const allPoints=await chartPoints();
            if(width<=375) {
                await page.touchscreen.tap(allPoints.first.x,allPoints.first.y);
                await page.touchscreen.tap(allPoints.last.x,allPoints.last.y);
            } else {
                await page.mouse.click(allPoints.first.x,allPoints.first.y);
                await page.mouse.click(allPoints.last.x,allPoints.last.y);
            }
            const measured=await measurementText('4 returned observations');
            assert.match(measured,/Exploring · not saved/);assert.match(measured,/1 Jul(?:y)? 2026[\s\S]*16 Oct(?:ober)? 2026/);assert.match(measured,/USD\s*40/);assert.match(measured,/50(?:\.0+)?%/);assert.match(measured,/4 returned observations/);assert.doesNotMatch(measured,/sessions/i);
            assert.equal(apiRequests.length,requestsBeforeMeasurement,'Measurement is local and must not request or write data.');await measurementGeometry('tap measurement');
            if(width!==320)await shot('measurement-light');
            await page.keyboard.press('Escape');assert.equal(await measurement.count(),0,'Escape clears the measurement.');assert.equal(await measure.getAttribute('aria-pressed'),'false');
            const forwardPoints=await chartPoints();await page.mouse.move(forwardPoints.first.x,forwardPoints.first.y);await page.mouse.down();await page.mouse.move(forwardPoints.last.x,forwardPoints.last.y,{steps:3});await page.mouse.up();
            await measurementText('4 returned observations');assert.match(await measurement.innerText(),/1 Jul(?:y)? 2026[\s\S]*16 Oct(?:ober)? 2026/);await measurementGeometry('forward drag');
            const backwardPoints=await chartPoints();await page.mouse.move(backwardPoints.last.x,backwardPoints.last.y);await page.mouse.down();await page.mouse.move(backwardPoints.first.x,backwardPoints.first.y,{steps:3});await page.mouse.up();
            await measurementText('4 returned observations');assert.match(await measurement.innerText(),/1 Jul(?:y)? 2026[\s\S]*16 Oct(?:ober)? 2026/);await measurementGeometry('backward drag');
            await page.keyboard.press('Escape');
            const pointerPoints=await chartPoints();
            await svg.evaluate(el=>el.addEventListener('pointerdown',event=>{el.dataset.qaPointerId=String(event.pointerId);},{once:true}));
            await page.mouse.move(pointerPoints.first.x,pointerPoints.first.y);await page.mouse.down();
            const pointerId=Number(await svg.getAttribute('data-qa-pointer-id'));
            for(const event of ['pointerup','pointercancel','lostpointercapture'])await svg.dispatchEvent(event,{pointerId:pointerId+100,isPrimary:false,pointerType:'touch',bubbles:true});
            await page.mouse.move(pointerPoints.last.x,pointerPoints.last.y,{steps:3});
            await page.waitForFunction(()=>document.querySelector('[data-testid="research-measurement"]')?.textContent?.includes('4 returned observations'),null,{timeout:3000});
            await svg.dispatchEvent('pointercancel',{pointerId,isPrimary:true,pointerType:'mouse',bubbles:true});
            await page.mouse.move(pointerPoints.first.x,pointerPoints.first.y,{steps:3});await page.mouse.up();
            assert.match(await measurement.innerText(),/4 returned observations/,'Secondary pointers cannot cancel the active drag; a matching cancellation stops further extension.');
            await chart.getByRole('button',{name:'Clear measurement',exact:true}).click();assert.equal(await measurement.count(),0,'Clear measurement exits measurement mode.');assert.equal(await measure.getAttribute('aria-pressed'),'false');
            await scrubber.focus();await scrubber.press('Home');await scrubber.press('Shift+ArrowRight');await scrubber.press('Shift+ArrowRight');await measurementText('3 returned observations');
            assert.match(await measurement.innerText(),/1 Jul(?:y)? 2026[\s\S]*1 Oct(?:ober)? 2026/);await chart.getByRole('button',{name:'Clear measurement',exact:true}).click();
            await measure.click();const outside=page.getByRole('heading',{level:1});await outside.dispatchEvent('pointerdown',{bubbles:true});assert.equal(await measurement.count(),0,'Outside pointerdown clears an incomplete measurement.');
            await measure.click();const resetPoints=await chartPoints();await page.mouse.click(resetPoints.first.x,resetPoints.first.y);await page.mouse.click(resetPoints.last.x,resetPoints.last.y);await measurementText('4 returned observations');
            await chart.getByRole('button',{name:'1M',exact:true}).click();assert.equal(await measurement.count(),0,'Changing the range clears measurement state.');assert.equal(await measure.getAttribute('aria-pressed'),'false');
            await chart.getByRole('button',{name:'All',exact:true}).click();
            if(width!==320) {await page.getByRole('radio',{name:'Dark',exact:true}).check();await page.waitForFunction(()=>document.documentElement.getAttribute('data-v8-theme')==='dark');}
            await measure.click();const darkPoints=await chartPoints();await page.mouse.click(darkPoints.first.x,darkPoints.first.y);await page.mouse.click(darkPoints.last.x,darkPoints.last.y);await measurementText('4 returned observations');
            if(width!==320)await shot('measurement-dark');
            assert.equal(apiRequests.length,requestsBeforeMeasurement,'Drag, keyboard, range and theme exploration must not request data.');
            const refreshResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/research/symbol/AAPL'&&new URL(response.url()).searchParams.get('market')==='US');
            await page.getByRole('button',{name:'Refresh provider data',exact:true}).focus();
            assert.equal(await measurement.count(),1,'Focus alone must not clear a measurement.');
            await page.keyboard.press('Enter');await refreshResponse;await measurement.waitFor({state:'detached'});
            assert.equal(await measurement.count(),0,'A refreshed snapshot clears measurement state without an outside pointer event.');
            await measure.click();const reloadPoints=await chartPoints();await page.mouse.click(reloadPoints.first.x,reloadPoints.first.y);await page.mouse.click(reloadPoints.last.x,reloadPoints.last.y);await measurementText('4 returned observations');
            await page.reload();await page.getByTestId('research-price').filter({hasText:'USD 200'}).waitFor();assert.equal(await page.getByTestId('research-measurement').count(),0,'Reload clears measurement state.');
            assert.match(await page.getByRole('region',{name:'Current provider quote'}).innerText(),/Daily change[\s\S]*\+1\.25%/);
            await shot('chart');
        }
        await page.getByRole('tab',{name:'Valuation',exact:true}).click();await shot('valuation-us');
        if(!before){await page.getByRole('region',{name:'Valuation availability'}).getByText('Why these values are unavailable',{exact:true}).click();assert.match(await page.getByRole('region',{name:'Valuation availability'}).innerText(),/outstanding shares/i);}
        await page.goto(`${base}/research-v8?ticker=5347&market=MY&tab=valuation`);await page.getByTestId('research-price').filter({hasText:'MYR 200'}).waitFor();assert.equal(await page.getByTestId('research-measurement').count(),0,'A new security snapshot clears measurement state.');await shot('valuation-my');
        if(!before){await page.getByRole('region',{name:'Valuation availability'}).getByText('Why these values are unavailable',{exact:true}).click();assert.match(await page.getByRole('region',{name:'Valuation availability'}).innerText(),/diluted average shares are not substituted/i);}
        if(!before){
            await page.goto(`${base}/research-v8?ticker=5347&market=MY`);await page.getByTestId('research-price').filter({hasText:'MYR 200'}).waitFor();
            const myChart=page.getByRole('region',{name:'Price history',exact:true});const mySvg=myChart.locator('svg');await myChart.getByRole('button',{name:'All',exact:true}).click();await myChart.getByRole('button',{name:'Measure',exact:true}).click();const myPoints=await chartPointsFor(mySvg);await page.mouse.click(myPoints.first.x,myPoints.first.y);await page.mouse.click(myPoints.last.x,myPoints.last.y);await page.waitForFunction(()=>document.querySelector('[data-testid="research-measurement"]')?.textContent?.includes('4 returned observations'));assert.match(await page.getByTestId('research-measurement').innerText(),/MYR\s*40[\s\S]*50(?:\.0+)?%/);await myChart.getByRole('button',{name:'Clear measurement',exact:true}).click();
            for(const symbol of ['FLAT','ZERO','ONE','EMPTY','NONAME','ETF']) {
                await page.goto(`${base}/research-v8?ticker=${symbol}&market=US`);await page.getByTestId('research-price').filter({hasText:'USD 200'}).waitFor();
                if(symbol==='FLAT') {
                    assert.match(await page.getByTestId('research-range-change').innerText(),/0%/);
                    const flatMeasure=chart.getByRole('button',{name:'Measure',exact:true});const flatSvg=chart.locator('svg');await flatMeasure.click();const flatPoints=await chartPointsFor(flatSvg);await page.mouse.click(flatPoints.first.x,flatPoints.first.y);await page.mouse.click(flatPoints.last.x,flatPoints.last.y);await page.waitForFunction(()=>document.querySelector('[data-testid="research-measurement"]')?.textContent?.includes('2 returned observations'));assert.match(await page.getByTestId('research-measurement').innerText(),/USD\s*0[\s\S]*0(?:\.0+)?%/);await chart.getByRole('button',{name:'Clear measurement',exact:true}).click();
                }
                if(symbol==='ZERO') {
                    assert.match(await page.getByTestId('research-range-change').innerText(),/percentage unavailable.*zero/i);
                    const zeroMeasure=chart.getByRole('button',{name:'Measure',exact:true});const zeroSvg=chart.locator('svg');await zeroMeasure.click();const zeroPoints=await chartPointsFor(zeroSvg);await page.mouse.click(zeroPoints.first.x,zeroPoints.first.y);await page.mouse.click(zeroPoints.last.x,zeroPoints.last.y);await page.waitForFunction(()=>document.querySelector('[data-testid="research-measurement"]')?.textContent?.includes('2 returned observations'));assert.match(await page.getByTestId('research-measurement').innerText(),/USD\s*100[\s\S]*percentage unavailable/i);await chart.getByRole('button',{name:'Clear measurement',exact:true}).click();
                }
                if(symbol==='ONE') {assert.match(await page.getByTestId('research-range-change').innerText(),/One observation/);assert.equal(await chart.getByRole('slider').isDisabled(),true);assert.equal(await chart.getByRole('button',{name:'Measure',exact:true}).isDisabled(),true);assert.match(await chart.innerText(),/at least two|cannot measure/i);}
                if(symbol==='EMPTY') {assert.equal(await chart.locator('svg').count(),0);assert.match(await chart.innerText(),/No price history returned/);assert.equal(await chart.getByRole('button',{name:'Measure',exact:true}).count(),0);}
                if(symbol==='NONAME')await page.getByRole('heading',{level:1,name:'NONAME',exact:true}).waitFor();
                if(symbol==='ETF')await page.getByRole('region',{name:'Financial assessment status'}).getByText('Assessment unsupported',{exact:true}).waitFor();
            }
            fail=true;await page.getByRole('button',{name:'Refresh provider data',exact:true}).click();await page.getByRole('button',{name:'Retry provider data',exact:true}).waitFor();assert.match(await page.getByRole('region',{name:'Provider data status'}).innerText(),/Previous values/);fail=false;
            await page.goto(`${base}/research-v8?ticker=SLOW&market=US`);await page.getByRole('heading',{level:1,name:'SLOW',exact:true}).waitFor();
            for(let i=0;i<100&&!releaseSlow;i++)await page.waitForTimeout(20);
            assert.equal(typeof releaseSlow,'function');
            await page.getByText('Change stock',{exact:true}).click();await page.getByLabel('Company or ticker',{exact:true}).fill('MSFT');await page.getByRole('button',{name:'Read ticker directly',exact:true}).click();
            await page.getByRole('heading',{level:1,name:'Fixture MSFT company with a long readable name',exact:true}).waitFor();releaseSlow();await page.waitForTimeout(100);
            assert.equal(await page.getByRole('heading',{level:1}).innerText(),'Fixture MSFT company with a long readable name');
        }
        assert.deepEqual(errors,[]);
        report.push({name:'interaction-checks',width,passed:true,unexpectedConsoleOrRequestErrors:errors,expectedConsole,apiReads:apiRequests.length});
        } catch(error) {
            const measurementText=await page.getByTestId('research-measurement').allInnerTexts().catch(()=>[]);
            const screenshot=`${out}/failure-${width}.png`;
            await page.screenshot({path:screenshot,fullPage:true}).catch(()=>{});
            report.push({name:'failure',width,url:page.url(),error:error instanceof Error?error.message:String(error),measurementText,screenshot});
            throw error;
        } finally {await context.close();}
    }
} finally {await browser.close();await writeFile(`${out}/report.json`,JSON.stringify({fixtureOnly:true,before,report},null,2));}
console.log(`Research reading ${before?'baseline captures':'checks passed'}: ${report.length} captured states.`);
