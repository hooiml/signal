import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.SIGNAL_QA_URL||'http://127.0.0.1:3000';const output=`.tmp/v8-enhancement/batch6-${Date.now()}`;await mkdir(output,{recursive:true});
const read=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);return r.json();};
const [watchlist,provider]=await Promise.all([read('/api/research/watchlist'),read('/api/research/symbol/AAPL?market=US')]);
let count=3;const source=watchlist.data.find(r=>r.symbol==='AAPL');assert.ok(source);
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});const page=await context.newPage();const errors=[],ledger=[],topByWidth={};page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/**',route=>{const url=new URL(route.request().url());if(route.request().method()!=='GET')return route.fulfill({json:{success:true}});
    if(url.pathname.endsWith('/watchlist'))return route.fulfill({json:{success:true,data:Array.from({length:count},(_,i)=>({...source,symbol:i===0?'AAPL':`QA${i}`,companyName:i===0?'Apple Inc.':`Saved company ${i}`})),archivedSymbols:[]}});
    if(url.pathname.includes('/symbol/')){const copy=structuredClone(provider);copy.data.symbol=url.pathname.split('/').at(-1);return route.fulfill({json:copy});}return route.continue();
});
try{
    for(const width of [1280,768,375])for(const size of [3,10,35]){
        count=size;await page.setViewportSize({width,height:900});await page.goto(`${base}/research-v8?ticker=AAPL`);await page.getByRole('article',{name:'AAPL research'}).waitFor();
        const selector=page.getByRole('button',{name:/^Saved securities/});assert.equal(await selector.getAttribute('aria-expanded'),'false');
        const identity=page.getByRole('region',{name:'Selected research security'});assert.ok(await identity.isVisible());
        const before=await page.getByRole('article',{name:'AAPL research'}).boundingBox();if(size===3)topByWidth[width]=before.y;assert.ok(before.y<700&&Math.abs(before.y-topByWidth[width])<=2,`research position independent of ${size} records: ${before.y}`);
        await selector.focus();await page.keyboard.press('Enter');await page.getByRole('searchbox').fill('no-match');assert.equal(new URL(page.url()).searchParams.get('ticker'),'AAPL');assert.ok(await page.getByRole('dialog',{name:'Saved securities'}).isVisible());
        await page.getByRole('searchbox').fill('');await page.getByRole('combobox',{name:'Market',exact:true}).selectOption('MY');assert.equal(new URL(page.url()).searchParams.get('ticker'),'AAPL');await page.getByRole('combobox',{name:'Market',exact:true}).selectOption('All');
        const picker=page.getByRole('combobox',{name:'Selected saved security'});if(await picker.isVisible())await picker.selectOption('QA1');else await page.getByRole('region',{name:'Saved watchlist'}).getByRole('button').filter({has:page.getByText('QA1',{exact:true})}).click();
        await page.getByRole('article',{name:'QA1 research'}).waitFor();assert.equal(new URL(page.url()).searchParams.get('ticker'),'QA1');assert.equal(await page.getByRole('dialog').count(),0);
        const policy=page.locator('details').filter({has:page.locator('summary b').filter({hasText:'Policy guardrails'})});await policy.locator('summary').click();await policy.getByText('Assessment required in Research workspace',{exact:true}).waitFor();
        const href=await policy.getByRole('link').getAttribute('href');assert.ok(href.includes('workspace=policy')&&href.includes('ticker=QA1'));
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));ledger.push({width,size,researchTop:before.y,policyHref:href});if(size===35)await page.screenshot({path:`${output}/${width}.png`,fullPage:true});
    }
    // Verify the existing destination supports assessment; no policy changes or saves.
    await page.goto(`${base}/research?workspace=policy&ticker=AAPL`);await page.getByRole('heading',{name:'Investment-policy guardrails',exact:true}).waitFor();await page.getByRole('heading',{name:'Policy assessment',exact:true}).waitFor({state:'attached'});
    assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',ledger,policyDestination:'existing workspace rendered',errors},null,2));console.log(`PASS Research hierarchy ${output}`);
}finally{await browser.close();}
