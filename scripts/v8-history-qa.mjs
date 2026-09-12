import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.SIGNAL_QA_URL||'http://127.0.0.1:3000';const output=`.tmp/v8-enhancement/batch5-${Date.now()}`;await mkdir(output,{recursive:true});
const read=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);return r.json();};
const [us,index]=await Promise.all([read('/api/signals/v2?market=US&mode=standard&enableSocial=true'),read('/api/signals/replay?market=US&mode=standard&enableSocial=true')]);
const observed=index.data.summaries.find(r=>r.hasFullEvidence);const snapshot=await read(`/api/signals/replay?market=US&mode=standard&enableSocial=true&date=${observed.date}`);
const rows=Array.from({length:5},(_,i)=>({...observed,date:`2026-09-0${i+1}`,score:40+i*5,origin:i===1||i===2?'reconstructed':'observed',hasFullEvidence:i%2===0}));
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();const errors=[],ledger=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/signals/**',route=>{const url=new URL(route.request().url());if(url.pathname.endsWith('/v2')){const copy=structuredClone(us);copy.data.metadata.score_history=rows.map(r=>({date:r.date,score:r.score,tier:r.tier,origin:r.origin,coverage_note:r.coverageNote}));return route.fulfill({json:copy});}
    if(!url.searchParams.has('date'))return route.fulfill({json:{success:true,data:{...index.data,summaries:rows}}});
    const row=rows.find(r=>r.date===url.searchParams.get('date'));if(!row?.hasFullEvidence)return route.fulfill({status:404,json:{success:false}});
    const copy=structuredClone(snapshot);copy.data.summary=row;if(row.date===rows[2].date)copy.data.components=copy.data.components.filter(c=>c.key!=='vix');return route.fulfill({json:copy});
});
try{
    for(const width of [1280,768,375]){
        await page.setViewportSize({width,height:900});await page.goto(`${base}/main-v8`);await page.getByTestId('connected-score').waitFor();
        await page.getByText(/3 loaded \/ 0 pending/).waitFor();
        await page.getByRole('tab',{name:'History',exact:true}).click();await page.getByRole('tab',{name:'Forward outcomes',exact:true}).click();await page.getByRole('button',{name:'30-day outcomes',exact:true}).click();
        const chart=page.getByRole('slider',{name:'Market condition score',exact:true});await chart.focus();await page.keyboard.press('Home');
        assert.equal(await page.getByTestId('connected-score').innerText(),String(us.data.composite_score));assert.equal(await page.getByRole('button',{name:/Return to current/}).count(),0);
        await page.keyboard.press('ArrowRight');await page.getByText('Origin: reconstructed',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Open historical snapshot',exact:true}).isDisabled(),true);
        await page.keyboard.press('Home');await page.getByRole('button',{name:'Open historical snapshot',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="connected-score"]')?.textContent==='40');
        await chart.focus();await page.keyboard.press('End');assert.equal(await page.getByTestId('connected-score').innerText(),'40');await page.getByRole('button',{name:'Open historical snapshot',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="connected-score"]')?.textContent==='60');
        await page.getByRole('button',{name:/Return to current/}).click();assert.equal(await chart.getAttribute('aria-valuenow'),'0');assert.equal(await page.getByRole('button',{name:'30-day outcomes',exact:true}).getAttribute('aria-pressed'),'true');
        await chart.click({position:{x:100,y:50}});assert.equal(await page.getByRole('button',{name:/Return to current/}).count(),0);
        await chart.tap();assert.equal(await page.getByRole('button',{name:/Return to current/}).count(),0);
        assert.ok(await chart.locator('[data-origin="reconstructed"] path[stroke-dasharray]').count());
        const tile=page.locator('[data-indicator="vix"]');assert.equal(await tile.locator('[data-testid="archive-spark"] path').count(),2);await tile.click();
        const inspector=width<=900?page.getByRole('dialog',{name:'Indicator detail'}):page.getByRole('complementary',{name:'Selected indicator'});await inspector.getByText('All loaded archive segments · gaps retained',{exact:true}).waitFor();
        const d=await inspector.locator('svg[aria-label^="Archived raw readings"] path').getAttribute('d');assert.equal((d.match(/M/g)||[]).length,2);assert.equal(await inspector.locator('svg[aria-label^="Archived raw readings"] circle').count(),2);
        await page.keyboard.press('Escape');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/${width}.png`,fullPage:true});ledger.push({width,previewReplay:'passed',provenance:'passed',historyGaps:'passed'});
    }
    assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',ledger,errors},null,2));console.log(`PASS Historical evidence ${output}`);
}finally{await browser.close();}
