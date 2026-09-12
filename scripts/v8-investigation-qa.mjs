import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.SIGNAL_QA_URL||'http://127.0.0.1:3000';const output=`.tmp/v8-enhancement/batch4-${Date.now()}`;await mkdir(output,{recursive:true});
const read=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);return r.json();};
const [us,records,provider]=await Promise.all([read('/api/signals/v2?market=US&mode=standard&enableSocial=true'),read('/api/research/watchlist'),read('/api/research/symbol/AAPL?market=US')]);
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});const page=await context.newPage();
const errors=[],ledger=[];page.on('pageerror',e=>errors.push(e.message));let newer=false;
await page.route('**/api/**',route=>{const url=new URL(route.request().url());
    if(url.pathname.endsWith('/v2')){const copy=structuredClone(us);copy.data.mode=url.searchParams.get('mode');if(copy.data.metadata.historical_validation)copy.data.metadata.historical_validation.mode=copy.data.mode;if(newer)copy.data.composite_score+=5;return route.fulfill({json:copy});}
    if(url.pathname.endsWith('/replay'))return route.fulfill({json:{success:true,data:{market:'US',mode:url.searchParams.get('mode'),enableSocial:true,summaries:[]}}});
    if(url.pathname.endsWith('/watchlist'))return route.fulfill({json:records});
    if(url.pathname.includes('/symbol/')){const copy=structuredClone(provider);copy.data.symbol=url.pathname.split('/').at(-1);return route.fulfill({json:copy});}
    return route.continue();
});
try{
    await page.goto(`${base}/main-v8`);await page.getByTestId('connected-score').waitFor();
    await page.getByRole('tab',{name:'Scenarios',exact:true}).click();
    await page.locator('#connected-scenario-score').fill('20');const score=await page.locator('[class*="simulated"] strong').innerText();
    await page.getByRole('tab',{name:'Evidence',exact:true}).click();await page.getByRole('tab',{name:'Scenarios',exact:true}).click();assert.equal(await page.locator('#connected-scenario-score').inputValue(),'20');
    newer=true;await page.getByRole('button',{name:'Reload data',exact:true}).click();await page.getByText(/Newer reading available/).waitFor();assert.equal(await page.locator('[class*="simulated"] strong').innerText(),score);
    await page.getByRole('button',{name:'Reset to latest reading',exact:true}).click();assert.equal(await page.getByText(/Newer reading available/).count(),0);
    await page.getByRole('tab',{name:'History',exact:true}).click();await page.getByRole('tab',{name:'Forward outcomes',exact:true}).click();await page.getByRole('button',{name:'30-day outcomes',exact:true}).click();await page.getByRole('checkbox',{name:'Observed-origin scores only'}).check();
    await page.getByRole('tab',{name:'Context',exact:true}).click();await page.getByRole('tab',{name:'History',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Observed-origin scores only'}).isChecked(),true);assert.equal(await page.getByRole('button',{name:'30-day outcomes',exact:true}).getAttribute('aria-pressed'),'true');
    await page.getByRole('slider',{name:'Market condition score',exact:true}).focus();await page.keyboard.press('Home');await page.keyboard.press('Enter');
    await page.getByRole('button',{name:'Return to current',exact:false}).click();
    assert.equal(await page.getByRole('checkbox',{name:'Observed-origin scores only'}).isChecked(),true);
    assert.equal(await page.getByRole('button',{name:'30-day outcomes',exact:true}).getAttribute('aria-pressed'),'true');
    for(const width of [1280,768,375]){
        await page.setViewportSize({width,height:900});
        const tile=page.locator('[data-indicator="vix"]');await tile.scrollIntoViewIfNeeded();await tile.focus();const scroll=await page.evaluate(()=>scrollY);await page.keyboard.press('Enter');
        if(width>900){assert.equal(await tile.evaluate(el=>el===document.activeElement),true);assert.ok(Math.abs(await page.evaluate(()=>scrollY)-scroll)<=2,'opening inspector preserves scroll');assert.equal(await page.getByRole('complementary',{name:'Selected indicator'}).evaluate(el=>getComputedStyle(el).position),'sticky');}
        else {await page.getByRole('dialog',{name:'Indicator detail'}).waitFor();assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),true);}
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${output}/${width}.png`,fullPage:width>900});
        await page.keyboard.press('Escape');assert.equal(await tile.evaluate(el=>el===document.activeElement),true);ledger.push({width,inspector:'passed'});
    }
    await page.locator('[data-indicator="vix"]').click();await page.setViewportSize({width:1280,height:900});await page.locator('dialog[open]').waitFor({state:'hidden'});assert.equal(await page.locator('dialog[open]').count(),0);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('dialog')),false);
    await page.keyboard.press('Escape');await page.getByRole('button',{name:'Contrarian',exact:true}).click();await page.getByText(/Temporary investigation settings/).waitFor();await page.getByRole('tab',{name:'History',exact:true}).click();assert.equal(await page.getByRole('tab',{name:'Timeline',exact:true}).getAttribute('aria-selected'),'true');
    await page.goto(`${base}/research-v8?ticker=AAPL`);await page.getByRole('region',{name:'Price history',exact:true}).getByRole('button',{name:'1M',exact:true}).click();await page.getByRole('slider',{name:'Inspect a trading date'}).fill('2');const date=await page.locator('[class*="priceReadout"]').innerText();
    await page.getByRole('tab',{name:'Thesis',exact:true}).click();await page.getByRole('tab',{name:'Overview',exact:true}).click();assert.equal(await page.locator('[class*="priceReadout"]').innerText(),date);
    await page.getByRole('region',{name:'Saved watchlist'}).getByRole('button',{name:/MSFT/}).click();await page.getByRole('article',{name:'MSFT research'}).waitFor();assert.equal(await page.getByRole('region',{name:'Price history',exact:true}).getByRole('button',{name:'1M',exact:true}).getAttribute('aria-pressed'),'true');
    await page.reload();await page.getByRole('region',{name:'Price history',exact:true}).getByRole('button',{name:'3M',exact:true}).waitFor();assert.equal(await page.getByRole('region',{name:'Price history',exact:true}).getByRole('button',{name:'3M',exact:true}).getAttribute('aria-pressed'),'true');
    assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',ledger,checks:['scenario pin/reset','history tab retention/configuration reset','inspector focus/scroll/breakpoint','research range/date tabs/security/reload'],errors},null,2));console.log(`PASS Investigation continuity ${output}`);
}finally{await browser.close();}
