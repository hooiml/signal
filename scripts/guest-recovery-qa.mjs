import { fulfillEarningsCalendarRead } from './qa-earnings-calendar-fixture.mjs';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { marketRequestFixture } from './harness/market-request-fixture.mjs';

// Runs in the existing Research QA browser. All API responses are labelled fixtures.
export async function guestRecoveryQa(browser, base, snapshot) {
 const out = '.tmp/guest-recovery'; await mkdir(out, {recursive:true});
 const results = []; const key = 'signal.guest-research.v1'; const prefix = `${key}.draft.`;
 for (const width of [1440,1280,768,390,375]) {
  const context = await browser.newContext({viewport:{width,height:width<=390?844:1000},serviceWorkers:'block'});
  const errors = [], writes = [], scoreRequests = []; let owner = false;
  await context.route('**/api/**', async route => {
   if (await fulfillEarningsCalendarRead(route)) return;
   const request = route.request(), url = new URL(request.url());
   if (request.method() !== 'GET') writes.push(url.pathname);
   if (url.pathname === '/api/owner/session') return route.fulfill({json:{success:true,data:{configured:true,unlocked:owner}}});
   if (url.pathname === '/api/research/watchlist') { assert.ok(owner, 'guest must not access owner research'); return route.fulfill({json:{success:true,data:[]}}); }
   if (url.pathname.startsWith('/api/research/symbol/')) return route.fulfill({json:snapshot(url.pathname.split('/').at(-1),url.searchParams.get('market'))});
   if (url.pathname === '/api/signals/v2') {
    scoreRequests.push(url.search); const f = marketRequestFixture();
    const response = await f.route.GET(f.request(url.search.slice(1))); return route.fulfill({json:await response.json()});
   }
   return route.fulfill({status:503,json:{success:false,error:'Optional fixture data unavailable'}});
  });
  let page = await context.newPage();
  const monitor = p => { p.on('pageerror',e=>errors.push(e.message)); p.on('requestfailed',r=>{if(!/ERR_ABORTED/.test(r.failure()?.errorText??''))errors.push(r.failure()?.errorText);}); };
  monitor(page);
  const url = `${base}/research-v8?ticker=AAPL&market=US`;
  const note = () => page.getByLabel('Personal note for AAPL',{exact:true});
  const backups = () => page.evaluate(p=>Object.keys(localStorage).filter(k=>k.startsWith(p)).map(k=>JSON.parse(localStorage.getItem(k))),prefix);
  const settledBackup = text => page.waitForFunction(({p,text})=>Object.keys(localStorage).some(k=>k.startsWith(p)&&JSON.parse(localStorage.getItem(k)).text===text),{p:prefix,text});
  const overflow = async () => assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);
  await page.goto(url); await page.getByRole('button',{name:'Save stock',exact:true}).click(); await note().waitFor();
  await note().fill('Recover this unsaved guest note'); await settledBackup('Recover this unsaved guest note');
  assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).records[0].notes,key),'');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByText('Export includes saved notes only.',{exact:false}).waitFor();
  page.once('dialog',d=>{assert.match(d.message(),/Unsaved drafts are not included/);d.dismiss();});
  await page.getByRole('button',{name:'Export guest research',exact:true}).click();
  assert.equal((await backups()).length,1);
  const download = page.waitForEvent('download'); page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Export guest research',exact:true}).click();
  const exported = JSON.parse(await readFile(await (await download).path(),'utf8')); assert.equal(exported.records[0].notes,'');
  await page.screenshot({path:`${out}/export-warning-${width}.png`});
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  page.once('dialog',d=>{assert.equal(d.type(),'beforeunload');d.accept();}); await page.reload();
  await page.getByRole('button',{name:'Restore AAPL draft',exact:true}).waitFor();
  assert.equal(await note().inputValue(),'','recovery must not auto-apply');
  await overflow(); await page.screenshot({path:`${out}/recover-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Restore AAPL draft',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#guest-research-note')?.value==='Recover this unsaved guest note');
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await page.waitForFunction(p=>!Object.keys(localStorage).some(k=>k.startsWith(p)),prefix);
  assert.equal(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).records[0].notes,key),'Recover this unsaved guest note');
  // A closed page has no component state; another page can still recover its backup.
  await note().fill('Draft before closing the page'); await settledBackup('Draft before closing the page'); await page.close();
  page = await context.newPage(); monitor(page); await page.goto(url);
  await page.getByRole('button',{name:'Restore AAPL draft',exact:true}).waitFor();
  // Owner mode must not render or import pending guest recovery data.
  owner = true; await page.reload(); await page.getByText('Owner workspace · Your private saved research',{exact:true}).waitFor();
  assert.equal(await page.getByRole('region',{name:'Recover unsaved guest notes'}).count(),0);
  assert.equal(await page.getByLabel('Personal note for AAPL',{exact:true}).count(),0);
  assert.ok((await backups()).some(b=>b.text==='Draft before closing the page'));
  owner = false; await page.reload(); await page.getByRole('button',{name:'Restore AAPL draft',exact:true}).click();
  await settledBackup('Draft before closing the page');
  const peer = await context.newPage(); monitor(peer); await peer.goto(url);
  await peer.getByLabel('Personal note for AAPL',{exact:true}).fill('Newer saved note in another tab');
  await peer.getByRole('button',{name:'Save note',exact:true}).click();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).records[0].notes==='Newer saved note in another tab',key);
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'newer note'}).waitFor();
  assert.equal(await note().inputValue(),'Draft before closing the page');
  await page.getByRole('button',{name:'Reload note',exact:true}).click(); await peer.close();
  // Failed backup writes must retain editor text and clearly explain recovery failure.
  await page.evaluate(p=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith(p))throw new DOMException('Fixture quota','QuotaExceededError');return window.qaSetItem.call(this,k,v);};},prefix);
  await note().fill('Draft with blocked backup storage'); await page.getByRole('alert').filter({hasText:'Draft recovery is unavailable'}).waitFor();
  assert.equal(await note().inputValue(),'Draft with blocked backup storage');
  await page.evaluate(()=>{Storage.prototype.setItem=window.qaSetItem;delete window.qaSetItem;});
  await page.getByRole('button',{name:'Retry draft recovery',exact:true}).click();
  await settledBackup('Draft with blocked backup storage');
  await overflow();
  const removeBox = await page.getByRole('button',{name:'Remove from watchlist',exact:true}).boundingBox();
  assert.ok(removeBox.height <= 60 && removeBox.width >= 90, 'note-header action stays readable');
  await page.locator('section[aria-labelledby="guest-note-title"]').screenshot({path:`${out}/draft-actions-${width}.png`});
  page.once('dialog',d=>d.accept()); await page.getByRole('button',{name:'Discard changes',exact:true}).click();
  await page.waitForFunction(p=>!Object.keys(localStorage).some(k=>k.startsWith(p)),prefix);
  // Recoverable-only drafts also warn on export and are removed by explicit clear.
  await note().fill('Discardable backup'); await settledBackup('Discardable backup'); await page.close();
  page=await context.newPage();monitor(page);await page.goto(url);
  await page.getByRole('button',{name:'Discard AAPL draft',exact:true}).waitFor();
  page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Discard AAPL draft',exact:true}).click();
  await page.waitForFunction(p=>!Object.keys(localStorage).some(k=>k.startsWith(p)),prefix);
  await note().fill('Clear backup');await settledBackup('Clear backup');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  page.once('dialog',d=>{assert.match(d.message(),/draft backups/);d.accept();});await page.getByRole('button',{name:'Clear guest research',exact:true}).click();
  await page.waitForFunction(k=>localStorage.getItem(k)===null,key);assert.equal((await backups()).length,0);
  await page.getByRole('button',{name:'Close settings',exact:true}).click();
  await page.getByRole('button',{name:'Save stock',exact:true}).click(); await note().fill('Backup before a delayed restore');
  await settledBackup('Backup before a delayed restore'); await page.close(); page=await context.newPage();monitor(page);await page.goto(url);
  await page.getByRole('button',{name:'Restore AAPL draft',exact:true}).waitFor();
  await page.evaluate(()=>{window.qaHeld=false;void navigator.locks.request('signal.guest-research.v1',()=>new Promise(resolve=>{window.qaRelease=resolve;window.qaHeld=true;}));});
  await page.waitForFunction(()=>window.qaHeld);await page.getByRole('button',{name:'Restore AAPL draft',exact:true}).click();
  await page.waitForFunction(async()=>((await navigator.locks.query()).pending??[]).length>0);
  await note().fill('New typing while restore waits');await page.evaluate(()=>window.qaRelease());await settledBackup('New typing while restore waits');
  assert.equal(await note().inputValue(),'New typing while restore waits','late recovery cannot erase typing');
  await page.getByRole('button',{name:'Settings',exact:true}).click();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Clear guest research',exact:true}).click();
  await page.waitForFunction(k=>localStorage.getItem(k)===null,key);await page.getByRole('button',{name:'Close settings',exact:true}).click();
  // The basic-view control must update the actual signal request in both markets.
  await page.getByRole('link',{name:'Market',exact:true}).click();
  const toggle=page.getByRole('checkbox',{name:'Include social in score',exact:true});await toggle.waitFor();
  await page.locator('summary',{hasText:'About these settings'}).click();await page.getByText(/Enabled · no usable social evidence/).waitFor();
  await toggle.uncheck();await page.getByText(/Excluded from score/).waitFor();
  await page.waitForFunction(()=>!document.body.textContent.includes('Updating the market reading'));
  assert.ok(scoreRequests.some(q=>q.includes('enableSocial=false')));
  await toggle.check();await page.getByText(/Enabled · no usable social evidence/).waitFor();
  await page.locator('#market-select').selectOption('MY');const news=page.getByRole('checkbox',{name:'Include news in score',exact:true});await news.waitFor();
  await news.uncheck();await page.getByText(/Excluded from score/).waitFor();
  assert.ok(scoreRequests.some(q=>q.includes('market=MY')&&q.includes('enableSocial=false')));
  await overflow();await page.screenshot({path:`${out}/market-toggle-${width}.png`});
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  results.push({width,passed:true,scenarios:['saved-only export warning cancel/continue','reload restore explicit save','closed page recovery','owner recovery isolation','restored draft stale-save conflict','quota warning and retry retain editor','delayed restore preserves new typing','discard and clear remove backups','basic social/news toggle requests','no API writes','no page errors','no overflow']});
  await context.close();
 }
 await writeFile(`${out}/report.json`,JSON.stringify({dataMode:'Controlled API fixtures; real browser storage, locks, downloads and UI',results},null,2));
 console.log('Guest recovery and source toggle browser checks passed.');
}
