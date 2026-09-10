import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const output = `.tmp/v8-connected/qa-${Date.now()}`;
await mkdir(output, { recursive: true });
const read = async path => {
    const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(60000) });
    assert.equal(response.status, 200, path);
    return response.json();
};
const [us, my, index] = await Promise.all([
    read('/api/signals/v2?market=US&mode=standard&enableSocial=true'),
    read('/api/signals/v2?market=MY&mode=standard&enableSocial=true'),
    read('/api/signals/replay?market=US&mode=standard&enableSocial=true'),
]);
const archivedDate = index.data.summaries.find(row => row.hasFullEvidence && row.date !== us.data.metadata.score_delta?.snapshot_date)?.date;
assert.ok(archivedDate, 'An observed archive must be available for this integration test');
const observed = await read(`/api/signals/replay?market=US&mode=standard&enableSocial=true&date=${archivedDate}`);
await writeFile(`${output}/service-data.json`, JSON.stringify({us,my,index,observed}));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [], requests = [], checks = [];
let variant = 'normal', delayResolve;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if(message.type()==='error' && !message.text().includes('status of 503') && !message.text().includes('status of 404')) errors.push(message.text()); });
page.on('request', request => { if(request.url().includes('/api/')) requests.push({url:request.url(),method:request.method(),body:request.postData()}); });
await page.route('**/api/signals/**', async route => {
    const url = new URL(route.request().url());
    const market = url.searchParams.get('market'), mode = url.searchParams.get('mode');
    if(url.pathname.endsWith('/v2')) {
        if(variant==='delay' && market==='MY') await new Promise(resolve => { delayResolve = resolve; });
        if(variant==='error') return route.fulfill({status:503,json:{success:false,error:'QA unavailable'}});
        const body = structuredClone(market==='MY'?my:us);
        body.data.mode = mode;
        if(body.data.metadata.historical_validation) body.data.metadata.historical_validation.mode=mode;
        if(variant==='invalid') body.data.composite_score='not a score';
        if(variant==='invalid-calibration') body.data.metadata.historical_validation.horizons[0].observations[0].forward_return_pct='invalid';
        if(variant==='invalid-context') body.data.metadata.market_context.yield_curve.spread_pct='invalid';
        if(variant==='history-only') body.data.components={};
        if(variant==='empty') { body.data.components={};body.data.metadata.score_history=[];delete body.data.metadata.historical_validation; }
        if(variant==='partial') {
            delete body.data.components.vix; delete body.data.metadata.historical_validation; delete body.data.metadata.market_context; delete body.data.metadata.weight_distribution;
            delete body.data.metadata.valuation_backdrop;body.data.metadata.articles=[];body.data.metadata.score_history=[];
        }
        if(variant==='coverage' && market==='US') {
            const indicator = body.data.components.vix;
            body.data.components = {
                vix: {...indicator,name:'vix',display_name:'VIX Index',value:15.3,score:81,weight:.35,signal:'buy',last_updated:'2026-09-08'},
                put_call: {...indicator,name:'put_call',display_name:'Put/call ratio',value:.76,score:70,weight:.1,signal:'buy',last_updated:'2026-09-08'},
                aaii: {...indicator,name:'aaii',display_name:'AAII',value:36.3,score:54.33333333333333,weight:.2,signal:'neutral',last_updated:'2026-07-08'},
            };
            body.data.composite_score=64;body.data.tier='neutral';
            body.data.confidence={...body.data.confidence,majority_signal:'NEUTRAL',conflicting_indicators:['vix','put_call'],agreement_pct:33};
            body.data.metadata.score_delta={...body.data.metadata.score_delta,snapshot_date:'2026-09-08'};
            body.data.metadata.coverage_adjustment={active_weight:.65,missing_weight:.35,neutral_baseline:50,active_points:46.21666666666667,neutral_points:17.5};
            body.data.metadata.signal_quality={...body.data.metadata.signal_quality,warnings:['AAII data is stale (2026-07-08).','VIX Index, Put/call ratio do not align with the majority NEUTRAL read.','Other source diagnostic retained.']};
        }
        return route.fulfill({json:body});
    }
    if(url.pathname.endsWith('/replay')) {
        const date=url.searchParams.get('date');
        if(!date) return route.fulfill({json:{success:true,data:{...index.data,market,mode,enableSocial:url.searchParams.get('enableSocial')==='true'}}});
        const summary=index.data.summaries.find(row=>row.date===date);
        if(!summary?.hasFullEvidence) return route.fulfill({status:404,json:{success:false,error:'No full evidence'}});
        const copy=structuredClone(observed);copy.data.summary={...summary};
        if(variant==='coverage') copy.data.components=[...copy.data.components.filter(item=>item.key!=='naaim'),{...copy.data.components[0],key:'naaim',displayName:'Manager exposure (NAAIM)',rawValue:62,score:44}];
        // Deterministic archive UI tests use captured component records; direct runtime proof follows below.
        return route.fulfill({json:copy});
    }
    return route.continue();
});
async function visible(locator) { await locator.waitFor({state:'visible'}); }
async function ready() { await visible(page.getByTestId('connected-score')); await page.getByRole('button',{name:'Reload data',exact:true}).waitFor(); }
async function dismiss() { const notice=page.getByRole('button',{name:'Dismiss notice',exact:true});if(await notice.isVisible())await notice.click(); }
async function geometry(name) {
    const result=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('main button, main h1, main h2, main input, main select')].filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1;}).map(el=>el.textContent?.slice(0,60))}));
    assert.ok(result.scroll<=result.width,`${name}: overflow ${JSON.stringify(result)}`);assert.deepEqual(result.outside,[],name);checks.push({name,...result});
}
async function shot(name) {await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/${name}.png`,fullPage:!(await page.locator('dialog[open]').count())});}
try {
    for(const width of [1280,768,375]) {
        await page.setViewportSize({width,height:900});await page.goto(`${base}/main-v8`);await ready();await dismiss();
        assert.equal(await page.getByTestId('connected-score').innerText(),String(us.data.composite_score));
        for(const [key,item] of Object.entries(us.data.components)) assert.equal(await page.locator(`[data-indicator=${key}] strong`).innerText(),String(Number(item.value.toFixed(3))));
        await page.locator('[data-indicator=vix] [data-testid=archive-spark]').waitFor();
        await geometry(`Connected current values ${width}`);await shot(`current-${width}`);
        const tile=page.locator('[data-indicator=vix]');await tile.focus();await page.keyboard.press('Enter');
        const inspector=width<=900?page.getByRole('dialog',{name:'Indicator detail'}):page.getByRole('complementary',{name:'Selected indicator'});
        await visible(inspector.getByRole('heading',{name:us.data.components.vix.display_name,exact:true}));
        await visible(inspector.getByText(`${us.data.components.vix.score.toFixed(2)} / 100`,{exact:true}));
        if(width<=900) for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('dialog')),true);}
        await shot(`indicator-${width}`);await page.keyboard.press('Escape');
        await page.locator('[data-indicator="vix"]:focus').waitFor({state:'attached',timeout:3000});
        assert.equal(await tile.evaluate(el=>el===document.activeElement),true);
        await page.getByRole('tab',{name:'Evidence',exact:true}).click();await geometry(`Connected evidence ${width}`);await shot(`evidence-${width}`);
        await page.getByRole('tab',{name:'Context',exact:true}).click();
        if(us.data.metadata.valuation_backdrop) await visible(page.getByText(`${us.data.metadata.valuation_backdrop.ratio_pct.toFixed(1)}%`,{exact:true}));
        await geometry(`Connected context ${width}`);await shot(`context-${width}`);
        await page.getByRole('button',{name:'Historical calibration →',exact:true}).click();
        const timeline=page.getByTestId('market-v8-timeline');const cursor=timeline.getByRole('slider');
        await timeline.getByTestId('timeline-range-all').click();
        assert.equal(Number(await cursor.getAttribute('aria-valuemax'))+1,us.data.metadata.historical_validation.timeline.length);
        await cursor.focus();await page.keyboard.press('Home');assert.match(await cursor.getAttribute('aria-valuetext'),/Benchmark 100.0 rebased/);
        await page.keyboard.press('ArrowRight');assert.equal(await cursor.getAttribute('aria-valuenow'),'1');
        await timeline.getByTestId('timeline-range-1m').click();await cursor.focus();await page.keyboard.press('Home');assert.match(await cursor.getAttribute('aria-valuetext'),/Benchmark 100.0 rebased/);
        await timeline.getByTestId('timeline-range-all').click();await geometry(`Connected full historical timeline ${width}`);await shot(`history-${width}`);
        for(const name of ['Forward outcomes','Score zones','Cases','Method']) {await page.getByRole('tab',{name,exact:true}).click();await geometry(`Connected calibration ${name} ${width}`);}
        await page.getByRole('tab',{name:'Score zones',exact:true}).click();assert.equal(await page.locator('#connected-calibration-view tbody tr').count(),5);
        await page.getByLabel('Observed-origin scores only').check();await shot(`observed-zones-${width}`);
        await page.getByRole('tab',{name:'Scenarios',exact:true}).click();const slider=page.getByLabel('Hypothetical normalized score',{exact:false});await slider.focus();await page.keyboard.press('End');
        assert.equal(await page.getByTestId('connected-score').innerText(),String(us.data.composite_score));await page.getByRole('button',{name:'Reset scenario'}).click();await geometry(`Connected scenario ${width}`);
        await page.getByRole('button',{name:'All',exact:true}).click();
        const historyDates=[...new Set(us.data.metadata.score_history.map(row=>row.date))].sort();
        const missingIndex=historyDates.findIndex(date=>!index.data.summaries.some(row=>row.date===date&&row.hasFullEvidence));
        assert.ok(missingIndex>=0,'A score-only history date must exist for this boundary test');
        const overview=page.getByRole('slider',{name:'Market condition score',exact:true});await overview.focus();await page.keyboard.press('Home');
        for(let i=0;i<missingIndex;i++)await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Enter');
        await visible(page.getByText('Historical indicator records unavailable',{exact:true}));assert.equal(await page.locator('[data-indicator]').count(),0);assert.equal(await page.getByTestId('market-calibration').count(),0);
        await page.getByRole('button',{name:'Return to current ↗'}).click();
        // Select the recorded full archive date through the accessible overview cursor.
        const idx=historyDates.indexOf(archivedDate);
        assert.ok(idx>=0);await overview.focus();await page.keyboard.press('Home');for(let i=0;i<idx;i++)await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
        await visible(page.getByRole('region',{name:'Archived indicator evidence'}).locator('details').first());await geometry(`Connected archived evidence ${width}`);await shot(`archived-${width}`);
        await page.getByRole('button',{name:'Return to current ↗'}).click();await page.getByLabel('Market',{exact:true}).selectOption('MY');await ready();
        await visible(page.getByRole('checkbox',{name:'News input',exact:true}));
        assert.equal(await page.getByTestId('connected-score').innerText(),String(my.data.composite_score));await page.getByRole('tab',{name:'Context',exact:true}).click();await geometry(`Connected Malaysia ${width}`);await shot(`my-${width}`);
        checks.push({name:`Payload score/raw values, provenance, filters, keyboard and historical cutoff ${width}`,pass:true});
        variant='coverage';await page.goto(`${base}/main-v8`);await ready();await dismiss();
        const quality=page.getByRole('region',{name:'Data needs attention'});
        const disagreement=page.getByRole('region',{name:'Indicator disagreement'});
        await visible(quality.getByText('AAII: stale observation.',{exact:true}));
        await visible(quality.getByText('Other source diagnostic retained.',{exact:true}));
        await visible(disagreement.getByText('VIX Index, Put/call ratio do not align with the overall NEUTRAL reading.',{exact:true}));
        assert.ok(!(await quality.innerText()).includes('do not align'));
        assert.ok(!(await disagreement.innerText()).includes('Social Sentiment'));
        assert.equal(await page.getByTestId('connected-score').innerText(),'64');
        const naaim=page.locator('[data-indicator=naaim]');
        await visible(naaim.getByText(/Historical readings only · last archived snapshot/));
        assert.equal(await naaim.locator('strong').innerText(),'—');
        await visible(naaim.getByTestId('archive-spark'));
        await geometry(`Separated quality/disagreement and archived-only indicator ${width}`);await shot(`coverage-${width}`);
        await naaim.focus();await page.keyboard.press('Enter');
        const missingInspector=width<=900?page.getByRole('dialog',{name:'Indicator detail'}):page.getByRole('complementary',{name:'Selected indicator'});
        await visible(missingInspector.getByRole('heading',{name:'Current value unavailable',exact:true}));
        await visible(missingInspector.getByText('Historical readings only · these snapshots do not supply a current value.',{exact:true}));
        assert.equal(await missingInspector.getByText('Normalized score',{exact:true}).count(),0);
        await shot(`missing-indicator-${width}`);await page.keyboard.press('Escape');
        await quality.getByRole('button',{name:'Review source coverage'}).focus();await page.keyboard.press('Enter');
        await page.locator('#investigation-panel:focus').waitFor({state:'attached',timeout:3000});
        assert.equal(await page.locator('#investigation-panel').evaluate(el=>el===document.activeElement),true);
        await page.getByRole('checkbox',{name:'Social input',exact:true}).uncheck();await ready();
        await visible(page.locator('[data-indicator=social]').getByText('Disabled by you',{exact:true}));
        assert.ok(!(await quality.innerText()).includes('Social Sentiment'));
        await page.locator('[data-indicator=social]').click();
        await visible(missingInspector.getByRole('heading',{name:'Input switched off',exact:true}));
        await page.keyboard.press('Escape');
        variant='normal';await page.getByLabel('Market',{exact:true}).selectOption('MY');await ready();
        await visible(page.locator('[data-indicator=news]').getByText('Disabled by you',{exact:true}));
        checks.push({name:`Coverage action, missing inspector, US/MY disabled distinction and unchanged score ${width}`,pass:true});
    }
    await page.setViewportSize({width:1280,height:900});await page.goto(`${base}/main-v8`);await ready();
    variant='delay';await page.getByLabel('Market',{exact:true}).selectOption('MY');await visible(page.getByRole('heading',{name:'Loading the market reading…'}));assert.equal(await page.getByTestId('connected-score').count(),0);
    await page.getByRole('button',{name:'Contrarian',exact:true}).click();await page.getByLabel('Market',{exact:true}).selectOption('US');variant='normal';delayResolve?.();await ready();
    assert.equal(await page.getByTestId('connected-score').innerText(),String(us.data.composite_score));
    await page.getByRole('checkbox',{name:'Social input',exact:true}).uncheck();await ready();assert.ok(requests.some(r=>r.url.includes('enableSocial=false')&&r.url.includes('mode=contrarian')));
    variant='error';await page.getByRole('button',{name:'Reload data',exact:true}).click();await visible(page.locator('main [role=alert]'));assert.equal(await page.getByTestId('connected-score').innerText(),String(us.data.composite_score));
    variant='normal';await page.getByRole('button',{name:'Reload data',exact:true}).click();await ready();
    for(const state of ['partial','empty','history-only','invalid','invalid-calibration','invalid-context']) {
        variant=state;await page.goto(`${base}/main-v8`);await dismiss();
        if(state==='partial') {await ready();assert.equal(await page.locator('[data-indicator=vix] strong').innerText(),'—');await page.getByRole('tab',{name:'Evidence',exact:true}).click();await geometry('Evidence without weight distribution');await page.getByRole('tab',{name:'History',exact:true}).click();await visible(page.getByText('Historical calibration is unavailable',{exact:true}));}
        if(state==='empty'||state==='history-only') await visible(page.getByRole('heading',{name:'No observations. No market call.'}));
        if(state.startsWith('invalid')) {await visible(page.locator('main [role=alert]'));assert.equal(await page.getByTestId('connected-score').count(),0);}
        if(state==='history-only'){assert.equal(await page.getByTestId('connected-score').count(),0);await visible(page.getByRole('heading',{name:'Stored history only'}));}
        await geometry(`Connected ${state} response`);await shot(state);
    }
    checks.push({name:'Loading, configuration isolation, source query, error retention/retry, missing, empty and invalid response',pass:true});
    await page.unroute('**/api/signals/**');variant='normal';
    let runtimeSignal;
    page.on('response',async response=>{if(response.url().includes('/api/signals/v2?')&&response.status()===200)runtimeSignal=(await response.json()).data;});
    await page.goto(`${base}/main-v8`);await ready();await dismiss();
    assert.equal(await page.getByTestId('connected-score').innerText(),String(runtimeSignal.composite_score));
    await page.getByRole('tab',{name:'History',exact:true}).click();await page.getByTestId('timeline-range-all').click();
    assert.equal(Number(await page.getByRole('slider',{name:'Shared historical timeline cursor'}).getAttribute('aria-valuemax'))+1,runtimeSignal.metadata.historical_validation.timeline.length);
    await shot('direct-runtime');checks.push({name:'Unmocked local service: rendered score and full timeline match HTTP response',score:runtimeSignal.composite_score,timeline:runtimeSignal.metadata.historical_validation.timeline.length});
    assert.deepEqual(errors,[]);assert.ok(requests.every(request=>request.method==='GET'&&!request.body));
    checks.push({name:'No mutation requests or runtime exceptions',pass:true});
} catch(error) {errors.push(error.stack);await shot('failure').catch(()=>{});process.exitCode=1;}
finally {await writeFile(`${output}/report.json`,JSON.stringify({base,checks,errors,requests},null,2));console.log(JSON.stringify({output,checks:checks.length,errors},null,2));await browser.close();}
