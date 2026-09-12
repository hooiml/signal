import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from 'playwright';
const base=process.env.SIGNAL_QA_URL||'http://127.0.0.1:3000';
const output=`.tmp/v8-enhancement/batch3-${Date.now()}`;await mkdir(output,{recursive:true});
const source=await readFile('src/components/v8/read-data.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {readData}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const originalFetch=globalThis.fetch;
let attempts=0;
try {
    globalThis.fetch=async()=>{attempts++;return new Response('{}',{status:attempts===1?503:200});};
    await readData('/test',new AbortController().signal,{attemptMs:1000,budgetMs:2000});assert.equal(attempts,2);
    for(const status of [400,404,429]) {attempts=0;globalThis.fetch=async()=>{attempts++;return new Response('{}',{status});};await assert.rejects(readData('/test',new AbortController().signal));assert.equal(attempts,1);}
    attempts=0;globalThis.fetch=async()=>{attempts++;return new Response('invalid');};await assert.rejects(readData('/test',new AbortController().signal));assert.equal(attempts,1);
    globalThis.fetch=(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
    const started=Date.now();await assert.rejects(readData('/test',new AbortController().signal,{attemptMs:20,budgetMs:90}),/deadline/);assert.ok(Date.now()-started<250);
    const cancel=new AbortController();cancel.abort();await assert.rejects(readData('/test',cancel.signal));
}finally{globalThis.fetch=originalFetch;}
const read=async path=>{const r=await fetch(base+path,{signal:AbortSignal.timeout(60000)});assert.equal(r.status,200);return r.json();};
const [us,watchlist,provider,index]=await Promise.all([read('/api/signals/v2?market=US&mode=standard&enableSocial=true'),read('/api/research/watchlist'),read('/api/research/symbol/AAPL?market=US'),read('/api/signals/replay?market=US&mode=standard&enableSocial=true')]);
const summary=index.data.summaries.find(row=>row.hasFullEvidence);
const snapshot=summary?await read(`/api/signals/replay?market=US&mode=standard&enableSocial=true&date=${summary.date}`):null;
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let hold=false,release,releaseArchive,phase='normal',count=0;
const archiveRows=index.data.summaries.filter(row=>row.hasFullEvidence).slice(0,3);
await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url());
    if(url.pathname.endsWith('/watchlist'))return route.fulfill({json:watchlist});
    if(url.pathname.includes('/symbol/')) {
        if(hold&&url.pathname.endsWith('/AAPL'))await new Promise(resolve=>{release=resolve;});
        if(phase==='provider-fail')return route.fulfill({status:503,json:{success:false}});
        const copy=structuredClone(provider);copy.data.symbol=url.pathname.split('/').at(-1);return route.fulfill({json:copy});
    }
    if(url.pathname.endsWith('/v2')) {
        count++;if(phase==='retry'&&count===1)return route.fulfill({status:503,json:{success:false}});
        if(phase==='invalid')return route.fulfill({json:{success:true,data:{}}});
        if(hold&&url.searchParams.get('mode')==='standard')await new Promise(resolve=>{release=resolve;});
        const copy=structuredClone(us);copy.data.mode=url.searchParams.get('mode');if(copy.data.metadata.historical_validation)copy.data.metadata.historical_validation.mode=copy.data.mode;
        return route.fulfill({json:copy});
    }
    if(url.pathname.endsWith('/replay')) {
        if(url.searchParams.has('date')) {
            const date=url.searchParams.get('date');
            if(phase==='partial'&&date===archiveRows[1]?.date)return route.fulfill({status:404,json:{success:false}});
            if(phase==='partial'&&date===archiveRows[2]?.date)await new Promise(resolve=>{releaseArchive=resolve;});
            const copy=structuredClone(snapshot);copy.data.summary=index.data.summaries.find(row=>row.date===date);return route.fulfill({json:copy});
        }
        return route.fulfill({json:{success:true,data:{...index.data,mode:url.searchParams.get('mode'),summaries:phase==='partial'?archiveRows:summary?[summary]:[]}}});
    }
    return route.continue();
});
try {
    await page.goto(`${base}/main-v8`);await page.getByTestId('connected-score').waitFor();
    hold=true;await page.getByRole('button',{name:'Reload data',exact:true}).click();
    await page.getByText('Reloading this configuration; the previous response remains visible.').waitFor();
    assert.equal(await page.getByTestId('connected-score').innerText(),String(us.data.composite_score));
    await page.getByRole('button',{name:'Contrarian',exact:true}).click();
    await page.getByRole('button',{name:'Reload data',exact:true}).waitFor();hold=false;release?.();
    phase='retry';count=0;await page.getByRole('button',{name:'Reload data',exact:true}).click();await page.getByRole('button',{name:'Reload data',exact:true}).waitFor();assert.equal(count,2);
    phase='invalid';count=0;await page.getByRole('button',{name:'Reload data',exact:true}).click();await page.getByText(/invalid or mismatched score data/).waitFor();assert.equal(count,1);
    assert.equal(archiveRows.length,3,'Three archived snapshots required for partial-history test');
    phase='partial';await page.getByRole('button',{name:'Reload data',exact:true}).click();
    await page.getByText(/1 loaded \/ 1 pending \/ 1 failed/).waitFor();
    releaseArchive();await page.getByText(/2 loaded \/ 0 pending \/ 1 failed/).waitFor();
    phase='normal';await page.goto(`${base}/research-v8?ticker=AAPL`);await page.getByRole('button',{name:'Refresh provider data',exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Provider data status"] button')?.disabled);
    const price=await page.getByTestId('research-price').innerText();hold=true;
    await page.getByRole('button',{name:'Refresh provider data',exact:true}).click();await page.getByText(/Refreshing… Retrieved/).waitFor();assert.equal(await page.getByTestId('research-price').innerText(),price);
    await page.locator('summary').filter({hasText:/^Saved securities/}).click();await page.getByRole('region',{name:'Saved watchlist'}).getByRole('button',{name:/MSFT/}).click();
    await page.getByRole('article',{name:'MSFT research'}).waitFor();hold=false;release?.();
    await page.waitForFunction(()=>!document.querySelector('[aria-label="Provider data status"] button')?.disabled);
    phase='provider-fail';await page.getByRole('button',{name:'Refresh provider data',exact:true}).click();await page.getByText(/Provider refresh failed/).waitFor();assert.equal(await page.getByTestId('research-price').innerText(),price);
    assert.deepEqual(errors,[]);await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',checks:['bounded retry/deadline/cancellation/invalid payload','same-identity refresh retention','mode and ticker switch ignore late response','provider failure retains prior price'],errors},null,2));console.log(`PASS Loading recovery ${output}`);
}finally{await browser.close();}
