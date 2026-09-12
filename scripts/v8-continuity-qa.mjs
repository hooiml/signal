import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base=process.env.SIGNAL_QA_URL||'http://127.0.0.1:3000';
const output=`.tmp/v8-enhancement/batch2-${Date.now()}`;
await mkdir(output,{recursive:true});
const read=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);return r.json();};
const records=await read('/api/research/watchlist');
const snapshot=await read('/api/research/symbol/AAPL?market=US');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
const page=await context.newPage();
let saved=false,failed=false,reads=0;
const errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('503'))errors.push(m.text());});
await context.route('**/api/research/**',route=>{
    const url=new URL(route.request().url());requests.push({method:route.request().method(),path:url.pathname});
    if(route.request().method()!=='GET') { console.log('Non-GET blocked',url.pathname); return route.fulfill({status:200,json:{success:true}}); }
    if(url.pathname.endsWith('/watchlist')) {
        reads++;
        if(failed)return route.fulfill({status:503,json:{success:false}});
        const copy=structuredClone(records);
        if(saved)copy.data.find(r=>r.symbol==='MSFT').companyName='Microsoft updated research';
        return route.fulfill({json:copy});
    }
    if(url.pathname.includes('/symbol/')) {
        const copy=structuredClone(snapshot);copy.data.symbol=decodeURIComponent(url.pathname.split('/').at(-1));copy.data.market=url.searchParams.get('market');
        return route.fulfill({json:copy});
    }
    return route.continue();
});
try {
    for(const width of [1280,768,375]) {
        saved=false;failed=false;
        await page.setViewportSize({width,height:900});
        await page.goto(`${base}/research-v8?ticker=AAPL&tab=valuation&keep=yes`);
        await page.getByRole('article',{name:'AAPL research'}).waitFor();
        await page.getByRole('tab',{name:'Valuation',exact:true}).getAttribute('aria-selected').then(v=>assert.equal(v,'true'));
        await page.locator('summary').filter({hasText:/^Saved securities/}).click();
        const picker=page.getByRole('combobox',{name:'Selected saved security'});
        if(await picker.isVisible())await picker.selectOption('MSFT');
        else await page.getByRole('region',{name:'Saved watchlist'}).getByRole('button',{name:/MSFT/}).click();
        await page.getByRole('article',{name:'MSFT research'}).waitFor();
        assert.equal(new URL(page.url()).searchParams.get('ticker'),'MSFT');
        assert.equal(new URL(page.url()).searchParams.get('keep'),'yes');
        await page.getByRole('tab',{name:'Thesis',exact:true}).click();
        assert.equal(new URL(page.url()).searchParams.get('tab'),'thesis');
        await page.goBack();await page.getByRole('article',{name:'AAPL research'}).waitFor();
        await page.goForward();await page.getByRole('article',{name:'MSFT research'}).waitFor();
        await page.reload();await page.getByRole('article',{name:'MSFT research'}).waitFor();
        assert.equal(await page.getByRole('tab',{name:'Thesis',exact:true}).getAttribute('aria-selected'),'true');
        // Simulate the existing editor's saved server response; no live user record is mutated.
        saved=true;
        const before=reads;
        await page.waitForFunction(()=>!!document.querySelector('article'),null,{timeout:10000});
        await page.evaluate(()=>{window.__qaRealNow=Date.now;Date.now=()=>window.__qaRealNow()+6000;window.dispatchEvent(new Event('focus'));});
        await page.getByRole('heading',{name:'Microsoft updated research',exact:true}).waitFor();
        assert.ok(reads>before);
        const url=page.url();
        failed=true;
        await page.evaluate(()=>{Date.now=()=>window.__qaRealNow()+12000;window.dispatchEvent(new Event('focus'));});
        await page.getByText(/Saved research could not be refreshed/).waitFor();
        await page.getByRole('heading',{name:'Microsoft updated research',exact:true}).waitFor();
        assert.equal(page.url(),url);
        assert.equal(await page.getByRole('tab',{name:'Thesis',exact:true}).getAttribute('aria-selected'),'true');
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        await page.screenshot({path:`${output}/${width}.png`,fullPage:true});
    }
    failed=false;
    await page.goto(`${base}/research-v8?ticker=UNKNOWN`);
    await page.getByRole('alert').getByText(/No saved research found for UNKNOWN/).waitFor();
    assert.equal(await page.locator('article').count(),0);
    assert.deepEqual(errors,[]);
    assert.ok(requests.every(r=>r.method==='GET'));
    await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',widths:[1280,768,375],checks:['URL, reload, Back/Forward, tab replace, unrelated query preservation','simulated edit return revalidation, failed retention','unknown ticker, overflow, no live mutations'],errors,requests},null,2));
    console.log(`PASS Research continuity ${output}`);
}finally{await browser.close();}
