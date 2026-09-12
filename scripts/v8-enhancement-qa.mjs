import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { chromium } from 'playwright';

const base = process.env.SIGNAL_QA_URL || 'http://127.0.0.1:3000';
const output = `.tmp/v8-enhancement/batch1-${Date.now()}`;
await mkdir(output, { recursive: true });
const source = await readFile('src/components/v8/outcome-window.ts', 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { outcomeWindow } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
for (const dates of [['2026-09-01','2026-09-03','2026-09-02'],['2026-09-03','2026-09-02','2026-09-01'],['2026-09-03']]) {
    assert.deepEqual(outcomeWindow(dates, 7), { date: '2026-09-10', excluded: 0 });
}
assert.deepEqual(outcomeWindow([], 30), { date: null, excluded: 0 });
assert.deepEqual(outcomeWindow(['2026-02-30', null, '', '2026-09-03'], 30), { date: '2026-10-03', excluded: 3 });
assert.deepEqual(outcomeWindow(['invalid', '2026-02-30'], 7), { date: null, excluded: 2 });
const response = await fetch(`${base}/api/signals/v2?market=US&mode=standard&enableSocial=true`, { signal: AbortSignal.timeout(60000) });
assert.equal(response.status, 200);
const fixture = await response.json();
await writeFile(`${output}/source.json`, JSON.stringify(fixture));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
const page = await context.newPage();
const errors = [], failures = [], ledger = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('requestfailed', r => { if (!r.failure()?.errorText.includes('ERR_ABORTED')) failures.push(r.url()); });
let tier = 'neutral', delta = -3;
await page.route('**/api/signals/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/replay')) return route.fulfill({ json: { success: true, data: { market: 'US', mode: url.searchParams.get('mode'), enableSocial: true, summaries: [] } } });
    const body = structuredClone(fixture);
    body.data.tier = tier;
    body.data.mode = url.searchParams.get('mode');
    if (body.data.metadata.historical_validation) body.data.metadata.historical_validation.mode = body.data.mode;
    body.data.metadata.score_delta.delta = delta;
    return route.fulfill({ json: body });
});
const luminance = rgb => rgb.slice(0,3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
function contrast(fg,bg) { const a=luminance(fg),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05); }
try {
    for (const width of [1280,768,375]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${base}/main-v8`);
        await page.getByTestId('connected-score').waitFor();
        const notice=page.getByRole('button',{name:'Dismiss notice',exact:true});if(await notice.isVisible())await notice.click();
        for (const mode of ['Momentum','Contrarian']) {
            await page.getByRole('button',{name:mode,exact:true}).click();
            for (const value of ['strong-buy','buy','neutral','sell','strong-sell']) {
                tier=value;delta=value==='neutral'?0:value.includes('sell')?-3:3;
                await page.getByRole('button',{name:'Reload data',exact:true}).click();
                await page.getByRole('button',{name:'Reload data',exact:true}).waitFor();
                const badge=page.locator('[class*="scoreStrip"] > [class*="zone"]');
                await badge.getByText(tier.replaceAll('-',' '),{exact:true}).waitFor();
                const rgb=await badge.evaluate(el=>[getComputedStyle(el).color,getComputedStyle(el).backgroundColor].map(c=>c.match(/[\d.]+/g).map(Number)));
                assert.ok(contrast(...rgb)>=4.5,`tier contrast ${tier}`);
                assert.equal(await page.locator('[class*="scoreDelta"] b').evaluate(el=>getComputedStyle(el).color),'rgb(16, 35, 76)');
                ledger.push({width,mode,tier,contrast:contrast(...rgb)});
            }
        }
        for(const key of Object.keys(fixture.data.components)) {
            const tile=page.locator(`[data-indicator="${key}"]`);
            await tile.click();
            const inspector=width<=900?page.getByRole('dialog',{name:'Indicator detail'}):page.getByRole('complementary',{name:'Selected indicator'});
            const raw=await tile.locator('strong').innerText();
            assert.ok((await inspector.innerText()).includes(raw),`raw agreement ${key}`);
            await page.keyboard.press('Escape');
        }
        const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(geometry.scroll<=width,JSON.stringify(geometry));
        const colours=await page.locator('[class*="heroKicker"] > span:first-child').evaluate(el=>({colour:getComputedStyle(el).color,muted:getComputedStyle(el.closest('main')).getPropertyValue('--muted')}));
        assert.ok(contrast(colours.colour.match(/[\d.]+/g).map(Number),[243,248,255])>=4.5);
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:`${output}/${width}.png`,fullPage:true});
        ledger.push({width,geometry,colours,rawAgreement:true});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    await writeFile(`${output}/report.json`,JSON.stringify({ledger,errors,failures,dateCases:'passed'},null,2));
    console.log(`PASS Batch 1: date regression, tiers/modes/deltas, raw agreement, contrast, responsive geometry. ${output}`);
} finally { await browser.close(); }
