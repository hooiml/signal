import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const base=process.env.SIGNAL_QA_URL||'http://127.0.0.1:3000';const output=`.tmp/v8-enhancement/batch7-${Date.now()}`;await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});const page=await context.newPage();const errors=[],failed=[],ledger=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('503'))errors.push(m.text());});page.on('requestfailed',r=>{if(!r.failure()?.errorText.includes('ERR_ABORTED'))failed.push(r.url());});
await page.route('**/api/**',route=>route.request().method()==='GET'?route.continue():route.fulfill({json:{success:true}}));
async function geometry(name){
    const result=await page.evaluate(()=>{
        const visible=el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&!el.closest('details:not([open]) :not(summary)');
        const controls=[...document.querySelectorAll('main button, main select, main summary, main label:has(input[type="checkbox"]), main [class*="tools"] a')].filter(el=>visible(el)&&!el.closest('dialog:not([open])'));
        const small=controls.filter(el=>el.getBoundingClientRect().height<43.5).map(el=>({text:el.textContent.slice(0,50),height:el.getBoundingClientRect().height}));
        const smallText=[...document.querySelectorAll('main small, main time, main [class*="tileUnits"], main [class*="chartDates"]')].filter(visible).filter(el=>parseFloat(getComputedStyle(el).fontSize)<12).map(el=>el.textContent.slice(0,50));
        return {width:innerWidth,scroll:document.documentElement.scrollWidth,small,smallText};
    });
    assert.ok(result.scroll<=result.width,`${name} overflow: ${JSON.stringify(result)}`);assert.deepEqual(result.small,[],`${name} target sizes`);assert.deepEqual(result.smallText,[],`${name} metadata size`);ledger.push({name,...result});
}
try{
    for(const route of ['main-v8','research-v8?ticker=AAPL']){
        await page.goto(`${base}/${route}`);await (route.startsWith('main')?page.getByTestId('connected-score'):page.getByRole('article',{name:'AAPL research'})).waitFor({timeout:45000});
        const dismiss=page.getByRole('button',{name:'Dismiss notice',exact:true});if(await dismiss.isVisible())await dismiss.click();
        for(const width of [320,375,390,768,1024,1280,1440]){
            await page.setViewportSize({width,height:900});await geometry(`${route} ${width}`);
            if(route.startsWith('main')){
                const disclosure=page.getByRole('region',{name:'Data needs attention'}).locator('details');if(await disclosure.count()){assert.equal(await disclosure.getAttribute('open'),null);await disclosure.locator('summary').click();await geometry(`coverage expanded ${width}`);await disclosure.locator('summary').click();}
                for(const tab of ['Evidence','Scenarios','History']){await page.getByRole('tab',{name:tab,exact:true}).click();await geometry(`${route} ${tab} ${width}`);}await page.getByRole('tab',{name:'What changed',exact:true}).click();
            }else{
                await page.getByRole('button',{name:'Tools',exact:true}).click();await geometry(`research tools ${width}`);await page.getByRole('button',{name:'Close research panel'}).click();
                await page.getByRole('button',{name:/^Saved securities/}).click();await geometry(`saved selector ${width}`);await page.getByRole('button',{name:'Close research panel'}).click();
                for(const tab of ['Financials','Thesis','Valuation','Review']){await page.getByRole('tab',{name:tab,exact:true}).click();await geometry(`${route} ${tab} ${width}`);}await page.getByRole('tab',{name:'Overview',exact:true}).click();
            }
            if(width===375||width===1280){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${output}/${route.split('?')[0]}-${width}.png`});}
        }
        // Document zoom exercises 200% reflow; this is not a browser-chrome zoom preference test.
        await page.setViewportSize({width:1280,height:900});await page.evaluate(()=>{document.body.style.zoom='2';scrollTo(0,0);});await geometry(`${route} 200% document zoom`);await page.screenshot({path:`${output}/${route.split('?')[0]}-zoom200.png`});await page.evaluate(()=>document.body.style.zoom='');
    }
    // Controlled warning variants protect the disclosure boundary without provider writes.
    const qualityWarning='Social coverage is sparse; interpret this reading with care.';
    await page.route('**/api/signals/v2?*',async route=>{const response=await route.fetch();const body=await response.json();body.data.metadata.signal_quality.warnings=[qualityWarning];for(const item of Object.values(body.data.components))item.last_updated=new Date().toISOString();await route.fulfill({json:body});});
    await page.goto(`${base}/main-v8`);await page.getByTestId('connected-score').waitFor();
    const quality=page.getByRole('region',{name:'Data needs attention'});
    assert.ok((await quality.locator(':scope > p').innerText()).startsWith(qualityWarning));
    assert.equal(await quality.locator('details').getAttribute('open'),null);
    const providerWarning='Fundamentals could not be retrieved from the provider.';
    await page.route('**/api/research/symbol/AAPL?*',async route=>{const response=await route.fetch();const body=await response.json();body.data.warnings=[providerWarning];await route.fulfill({json:body});});
    await page.goto(`${base}/research-v8?ticker=AAPL`);
    const status=page.getByRole('region',{name:'Provider data status'});
    await status.getByText(`Provider coverage limited: ${providerWarning}`,{exact:true}).waitFor();
    assert.equal(await status.locator('details').getAttribute('open'),null);
    ledger.push({name:'Material market and provider warnings remain visible with technical details collapsed'});
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);await writeFile(`${output}/report.json`,JSON.stringify({status:'passed',ledger,errors,failed},null,2));console.log(`PASS Presentation polish ${output}`);
}finally{await browser.close();}
