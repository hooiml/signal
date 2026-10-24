import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { switchWatchlistStock } from './qa-watchlist-switch.mjs';

// Called by the existing matrix so all scenarios share one browser process.
export async function guestWorkspaceQa(browser, base, snapshot, ownerRecord) {
 const out = '.tmp/guest-workspace'; await mkdir(out, {recursive:true});
 const results = []; const key = 'signal.guest-research.v1';
 for (const width of [1440,390]) {
  const context = await browser.newContext({viewport:{width,height:width===390?844:1000},serviceWorkers:'block'});
  const other = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const errors = []; const privateRequests = []; const providerReads = [];
  async function fixtures(ctx) {
   await ctx.route('**/api/research/symbol/**', route => { const u = new URL(route.request().url()); providerReads.push(u.search); return route.fulfill({json:snapshot(decodeURIComponent(u.pathname.split('/').at(-1)),u.searchParams.get('market'))}); });
   await ctx.route('**/api/research/watchlist**', route => {privateRequests.push({method:route.request().method(),data:route.request().postData()});return route.fulfill({json:{success:true,data:[ownerRecord]}});});
   if (!process.env.SIGNAL_QA_OWNER_SECRET) await ctx.route('**/api/owner/session', route=>route.fulfill({json:{success:true,data:{configured:false,unlocked:false}}}));
  }
  await fixtures(context); await fixtures(other);
  const page = await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!/status of (401|500|503)/.test(m.text()))errors.push(m.text());});
  page.on('requestfailed',r=>{if(!/ERR_ABORTED/.test(r.failure()?.errorText??''))errors.push(r.failure()?.errorText);});
  const url = `${base}/research-v8?ticker=AAPL&market=US`;
  // dataStatus uses a labelled div, so query its accessible label directly.
  const guestReady = () => page.getByText('Welcome to Signal · Guest workspace. Your watchlist and notes are saved on this device.',{exact:true}).waitFor();
  const note = page.getByLabel('Personal note for AAPL',{exact:true});
  const raw = () => page.evaluate(k=>localStorage.getItem(k),key);
  const overflow = async () => assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Guest overflow at ${width}`);
  await page.goto(url); await guestReady(); await page.getByTestId('research-price').filter({hasText:'USD 200.00'}).waitFor();
  assert.equal(await page.getByText(/Unlock saved research|Saved research is locked/).count(),0);
  assert.equal(await raw(),null,'Loading must not create an ID or stored record');
  await page.getByRole('button',{name:'Save stock',exact:true}).click(); await note.waitFor();
  await note.fill('Guest A note only'); await page.getByRole('button',{name:'Save note',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Note saved on this device'}).waitFor();
  const first = JSON.parse(await raw()); assert.equal(first.records[0].notes,'Guest A note only');
  assert.deepEqual(privateRequests,[],'Guest reads and writes must never call owner watchlist');
  await page.reload(); await guestReady(); await note.waitFor(); assert.equal(await note.inputValue(),'Guest A note only');
  assert.equal(JSON.parse(await raw()).guestId,first.guestId,'Identity survives reload');
  const peer = await other.newPage(); await peer.goto(url); await peer.getByRole('button',{name:'Save stock',exact:true}).waitFor();
  assert.equal(await peer.evaluate(k=>localStorage.getItem(k),key),null,'Separate browser profile has no guest A data');
  await peer.getByRole('button',{name:'Save stock',exact:true}).click(); await peer.getByLabel('Personal note for AAPL').fill('Guest B'); await peer.getByRole('button',{name:'Save note',exact:true}).click();
  assert.equal(JSON.parse(await raw()).records[0].notes,'Guest A note only');
  assert.notEqual(await peer.evaluate(k=>JSON.parse(localStorage.getItem(k)).guestId,key),first.guestId);
  // Cross-tab refresh preserves a draft and rejects overwriting a newer saved note.
  await note.fill('Unsaved draft in tab A');
  const sibling = await context.newPage(); await sibling.goto(url); await sibling.getByLabel('Personal note for AAPL').fill('Newer note in tab B'); await sibling.getByRole('button',{name:'Save note',exact:true}).click();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).records[0].notes==='Newer note in tab B',key);
  assert.equal(await note.inputValue(),'Unsaved draft in tab A');
  await page.getByRole('button',{name:'Save note',exact:true}).click(); await page.getByRole('alert').filter({hasText:'newer note'}).waitFor();
  assert.equal(JSON.parse(await raw()).records[0].notes,'Newer note in tab B');
  await page.getByRole('button',{name:'Reload note',exact:true}).click(); assert.equal(await note.inputValue(),'Newer note in tab B'); await sibling.close();
  await overflow(); await page.screenshot({path:`${out}/guest-research-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:'Workspace',exact:true}).click();
  const download = page.waitForEvent('download'); await page.getByRole('button',{name:'Export guest research',exact:true}).click();
  const downloaded = await download; const exported=JSON.parse(await readFile(await downloaded.path(),'utf8'));
  assert.equal(exported.records[0].notes,'Newer note in tab B'); assert.equal(JSON.stringify(exported).includes(ownerRecord.notes),false);
  await overflow(); await page.screenshot({path:`${out}/guest-tools-${width}.png`});
  await page.getByRole('button',{name:'Close research panel'}).click();
  // Exercise the real signed owner cookie when the local test server is configured.
  if (process.env.SIGNAL_QA_OWNER_SECRET) {
   const locked=await context.request.post(`${base}/api/research/watchlist`,{data:{symbol:'AAPL',market:'US',saveOnly:true}});assert.equal(locked.status(),401);
   for(const method of ['get','patch','delete']) { const response=await context.request[method](`${base}/api/research/watchlist${method==='get'?'':'/AAPL'}`,method==='get'?{}:{data:{notes:'must not be saved'}}); assert.equal(response.status(),401); }
   const unlocked=await context.request.post(`${base}/api/owner/session`,{data:{secret:process.env.SIGNAL_QA_OWNER_SECRET}});assert.equal(unlocked.status(),200);
   await page.reload(); await page.getByText('Owner workspace · Your private saved research',{exact:true}).waitFor();
   await page.getByRole('heading',{name:ownerRecord.companyName,exact:true}).waitFor();
   assert.equal(await page.getByRole('navigation',{name:'Guest research navigation'}).count(),0);
   assert.equal(await note.count(),0); assert.equal(await raw(),JSON.stringify(first).replace('Guest A note only','Newer note in tab B'));
   assert.ok(privateRequests.length>0&&privateRequests.every(r=>r.method==='GET'),'Unlock may read owner data but never import guest data');
   await page.getByRole('button',{name:'Workspace',exact:true}).click(); await page.getByRole('button',{name:'Lock owner workspace and use guest mode',exact:true}).click();
   await guestReady(); await note.waitFor(); assert.equal(await note.inputValue(),'Newer note in tab B');
   assert.equal((await (await context.request.get(`${base}/api/owner/session`)).json()).data.unlocked,false);
  }
  // Quota errors are shown without reporting a save or overwriting the old note.
  await page.evaluate(()=>{window.__setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='signal.guest-research.v1')throw new DOMException('full','QuotaExceededError');return window.__setItem.call(this,k,v);};});
  await note.fill('Must not persist'); await page.getByRole('button',{name:'Save note',exact:true}).click(); await page.getByRole('alert').filter({hasText:'blocked or full'}).waitFor();assert.equal(JSON.parse(await raw()).records[0].notes,'Newer note in tab B');
  await page.evaluate(()=>{Storage.prototype.setItem=window.__setItem;delete window.__setItem;});
  const intact = await raw(); const storagePeer = await context.newPage(); await storagePeer.goto(url); await storagePeer.getByLabel('Personal note for AAPL').waitFor();
  await storagePeer.evaluate(k=>localStorage.setItem(k,'invalid between reads'),key);
  await page.getByRole('alert').filter({hasText:'Showing the last loaded guest records'}).first().waitFor();
  assert.equal(await note.inputValue(),'Must not persist'); assert.equal(await page.getByRole('button',{name:'Save note',exact:true}).isDisabled(),true);
  await storagePeer.evaluate(({k,raw})=>localStorage.setItem(k,raw),{k:key,raw:intact});
  await page.getByRole('alert').filter({hasText:'Showing the last loaded guest records'}).first().waitFor({state:'detached'}); await storagePeer.close();
  await page.getByRole('button',{name:'Workspace',exact:true}).click();
  page.once('dialog',dialog=>dialog.dismiss()); await page.getByRole('button',{name:'Clear guest research',exact:true}).click();assert.ok(await raw());
  page.once('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'Clear guest research',exact:true}).click();await page.waitForFunction(k=>localStorage.getItem(k)===null,key);
  assert.equal(await peer.evaluate(k=>JSON.parse(localStorage.getItem(k)).records[0].notes,key),'Guest B');
  await page.getByRole('button',{name:'Close research panel'}).click();
  await page.getByRole('button',{name:'Save stock',exact:true}).click(); await note.fill('Fresh draft after Clear');
  const resetPeer=await context.newPage(); await resetPeer.goto(`${base}/research-v8?ticker=MSFT&market=US`);
  await resetPeer.getByRole('button',{name:'Save stock',exact:true}).click();
  await page.getByRole('button',{name:/^Watchlist · 2/}).waitFor();
  assert.equal(await note.inputValue(),'Fresh draft after Clear','Refreshing the new identity must retain its draft');
  await switchWatchlistStock(page,'US:MSFT');
  await switchWatchlistStock(page,'US:AAPL');
  assert.equal(await note.inputValue(),'Fresh draft after Clear');
  await page.getByRole('button',{name:'Save note',exact:true}).click(); await page.getByRole('status').filter({hasText:'Note saved on this device'}).waitFor(); await resetPeer.close();
  await page.evaluate(k=>localStorage.setItem(k,'invalid original'),key); await page.reload(); await guestReady(); await page.getByRole('alert').filter({hasText:'original browser data was left untouched'}).first().waitFor();
  assert.equal(await raw(),'invalid original'); await page.getByTestId('research-price').filter({hasText:'USD 200.00'}).waitFor(); await overflow();
  await page.screenshot({path:`${out}/guest-storage-error-${width}.png`});
  // Ambiguous saved tickers never cause a guessed provider request.
  await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({version:1,guestId:crypto.randomUUID(),records:[{symbol:'DUAL',market:'US',companyName:'US fixture',notes:''},{symbol:'DUAL',market:'MY',companyName:'MY fixture',notes:''}]})),key);
  providerReads.length=0; await page.goto(`${base}/research-v8?ticker=DUAL`); await guestReady(); await page.getByRole('heading',{name:'Choose this security’s market',exact:true}).waitFor();
  assert.deepEqual(providerReads,[]); assert.equal(new URL(page.url()).searchParams.get('market'),null);
  await page.getByRole('button',{name:'Read DUAL in Malaysia',exact:true}).click(); await page.getByTestId('research-price').filter({hasText:'MYR'}).waitFor();
  assert.ok(providerReads.every(search=>new URLSearchParams(search).get('market')==='MY'));
  assert.equal(new URL(page.url()).searchParams.get('market'),'MY');
  const beforeSwitch=await raw(); const privateCount=privateRequests.length;
  await switchWatchlistStock(page,'US:DUAL');
  await page.getByTestId('research-price').filter({hasText:'USD'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('market'),'US');
  await page.getByText('Change stock',{exact:true}).click();
  assert.equal(await page.getByRole('combobox',{name:'Lookup market',exact:true}).inputValue(),'US');
  await page.goBack(); await page.getByTestId('research-price').filter({hasText:'MYR'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('market'),'MY');
  assert.equal(await page.getByRole('combobox',{name:'Lookup market',exact:true}).inputValue(),'MY');
  await page.goForward(); await page.getByTestId('research-price').filter({hasText:'USD'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('market'),'US');
  await switchWatchlistStock(page,'MY:DUAL');
  await page.getByTestId('research-price').filter({hasText:'MYR'}).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('market'),'MY');
  assert.equal(await raw(),beforeSwitch,'Navigation must not mutate guest records or notes');
  assert.equal(privateRequests.length,privateCount,'Guest navigation must not request owner records');
  await page.getByText('Change stock',{exact:true}).click();
  await page.evaluate(()=>scrollTo(0,0)); await overflow();
  await page.screenshot({path:`${out}/guest-navigation-${width}.png`});
  // Drafts are keyed by market + ticker and survive selection and history navigation.
  const dualNote=page.getByLabel('Personal note for DUAL',{exact:true});
  await switchWatchlistStock(page,'US:DUAL'); await dualNote.fill('Unsaved US draft');
  await switchWatchlistStock(page,'MY:DUAL'); await dualNote.fill('Unsaved MY draft');
  const guestNav=page.getByRole('navigation',{name:'Guest research navigation'});
  await guestNav.getByRole('status').filter({hasText:'2 unsaved notes'}).waitFor();
  await page.getByRole('button',{name:/^Watchlist · /}).click();
  assert.equal(await page.getByRole('region',{name:'Saved watchlist'}).getByText(/· Unsaved/).count(),2);
  await page.getByRole('button',{name:'Close research panel'}).click();
  await switchWatchlistStock(page,'US:DUAL'); assert.equal(await dualNote.inputValue(),'Unsaved US draft');
  await page.goBack(); assert.equal(await dualNote.inputValue(),'Unsaved MY draft');
  await page.goForward(); assert.equal(await dualNote.inputValue(),'Unsaved US draft');
  assert.equal(await raw(),beforeSwitch,'Drafts must not be saved automatically');
  const reloadWarning=page.waitForEvent('dialog',{timeout:5000});
  const cancelledReload=page.reload({timeout:3000}).catch(error=>assert.match(error.message,/ERR_ABORTED|Timeout 3000ms exceeded/));
  const warning=await reloadWarning; assert.equal(warning.type(),'beforeunload'); await warning.dismiss(); await cancelledReload;
  assert.equal(await dualNote.inputValue(),'Unsaved US draft');
  // A switched-away draft retains its original conflict baseline after another tab saves.
  await switchWatchlistStock(page,'MY:DUAL');
  const draftPeer=await context.newPage(); await draftPeer.goto(`${base}/research-v8?ticker=DUAL&market=US`);
  await draftPeer.getByLabel('Personal note for DUAL',{exact:true}).fill('New US note from another tab');
  await draftPeer.getByRole('button',{name:'Save note',exact:true}).click();
  await draftPeer.getByRole('status').filter({hasText:'Note saved on this device'}).waitFor();
  await switchWatchlistStock(page,'US:DUAL'); assert.equal(await dualNote.inputValue(),'Unsaved US draft');
  await page.getByRole('button',{name:'Save note',exact:true}).click(); await page.getByRole('alert').filter({hasText:'newer note'}).waitFor();
  await page.getByRole('button',{name:'Reload note',exact:true}).click(); assert.equal(await dualNote.inputValue(),'New US note from another tab');
  await guestNav.getByRole('status').filter({hasText:'1 unsaved note.'}).waitFor();
  // A hidden dirty draft still warns even when the visible security is clean.
  const leaveWarning=page.waitForEvent('dialog',{timeout:5000}); const leave=page.getByRole('link',{name:'Market',exact:true}).click({noWaitAfter:true});
  const leaveDialog=await leaveWarning; assert.equal(leaveDialog.type(),'beforeunload'); await leaveDialog.dismiss(); await leave;
  assert.match(page.url(),/research-v8/);
  await page.getByRole('tab',{name:'Financials',exact:true}).click();
  await guestNav.getByRole('button',{name:'Return to DUAL · MY draft',exact:true}).click();
  assert.equal(await page.getByRole('tab',{name:'Overview',exact:true}).getAttribute('aria-selected'),'true');
  assert.equal(await dualNote.inputValue(),'Unsaved MY draft');
  await guestNav.scrollIntoViewIfNeeded(); await overflow();
  await page.screenshot({path:`${out}/guest-draft-markers-${width}.png`});
  // Real Web Lock delay: a completed older save cannot erase newer typing, even after remount.
  await dualNote.fill('  Unsaved MY draft  ');
  await page.evaluate(()=>{window.__draftLockHeld=false;void navigator.locks.request('signal.guest-research.v1',()=>new Promise(resolve=>{window.__draftLockRelease=resolve;window.__draftLockHeld=true;}));});
  await page.waitForFunction(()=>window.__draftLockHeld);
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await page.waitForFunction(async()=>((await navigator.locks.query()).pending??[]).length>0);
  await switchWatchlistStock(page,'US:DUAL'); await switchWatchlistStock(page,'MY:DUAL');
  await dualNote.fill('Newer MY draft while save waits');
  await page.evaluate(()=>window.__draftLockRelease());
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).records.find(r=>r.market==='MY').notes==='Unsaved MY draft',key);
  assert.equal(await dualNote.inputValue(),'Newer MY draft while save waits');
  await switchWatchlistStock(page,'US:DUAL'); await switchWatchlistStock(page,'MY:DUAL');
  assert.equal(await dualNote.inputValue(),'Newer MY draft while save waits');
  await overflow(); await page.screenshot({path:`${out}/guest-draft-${width}.png`});
  await page.getByRole('button',{name:'Save note',exact:true}).click(); await page.getByRole('status').filter({hasText:'Note saved on this device'}).waitFor();
  assert.equal(await guestNav.getByRole('status').count(),0);
  await page.reload(); await dualNote.waitFor(); assert.equal(await dualNote.inputValue(),'Newer MY draft while save waits');
  // Replacing the device workspace must not revive drafts from its previous identity.
  await dualNote.fill('Old identity draft');
  await draftPeer.evaluate(k=>localStorage.setItem(k,JSON.stringify({version:1,guestId:crypto.randomUUID(),records:[{symbol:'DUAL',market:'MY',companyName:'Replacement fixture',notes:'Replacement workspace note'}]})),key);
  await page.waitForFunction(()=>document.querySelector('#guest-research-note')?.value==='Replacement workspace note');
  await draftPeer.close();
  await page.evaluate(k=>localStorage.removeItem(k),key); await page.goto(`${base}/research-v8`); await guestReady();
  await page.getByText('Search a company or ticker, or open one from your watchlist or Discover. Reading saves nothing.',{exact:true}).waitFor();
  assert.equal(await raw(),null,'The first-use explanation must not create guest records');
  // Real browser Web Locks serialize queued mutations from two different tabs.
  await page.evaluate(k=>localStorage.removeItem(k),key);
  await page.goto(`${base}/research-v8?ticker=MSFT&market=US`); await guestReady(); await page.getByRole('button',{name:'Save stock',exact:true}).waitFor();
  const concurrent = await context.newPage(); await concurrent.goto(`${base}/research-v8?ticker=TSLA&market=US`); await concurrent.getByTestId('research-price').filter({hasText:'USD 200.00'}).waitFor();
  await page.evaluate(()=>{window.__lockHeld=false;void navigator.locks.request('signal.guest-research.v1',()=>new Promise(resolve=>{window.__lockRelease=resolve;window.__lockHeld=true;}));});
  await page.waitForFunction(()=>window.__lockHeld);
  await Promise.all([page.getByRole('button',{name:'Save stock',exact:true}).click(),concurrent.getByRole('button',{name:'Save stock',exact:true}).click()]);
  await page.waitForFunction(async()=>((await navigator.locks.query()).pending??[]).filter(lock=>lock.name==='signal.guest-research.v1').length===2);
  await page.evaluate(()=>window.__lockRelease());
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)||'{}').records?.length===2,key);
  assert.deepEqual(JSON.parse(await raw()).records.map(r=>r.symbol).sort(),['MSFT','TSLA']); await concurrent.close();
  assert.deepEqual(errors,[]);
  results.push({width,passed:true,realOwnerCookie:!!process.env.SIGNAL_QA_OWNER_SECRET,scenarios:['no access code','local save/reload','profile isolation','cross-tab draft conflict','export','owner isolation/no import','owner lock','quota failure','clear cancel/confirm','corrupt storage preserves original','public data remains readable','ambiguous ticker requires explicit market','guest quick switch and keyboard selection','cross-market lookup and Back/Forward','unsaved drafts survive switches and history','reload and leave warnings include hidden drafts','switched draft conflict baseline','queued save preserves newer typing after remount','guest identity reset clears drafts','first-use guidance without storage writes','serialized concurrent cross-tab saves','no overflow','no runtime errors']});
  await context.close(); await other.close();
 }
 await writeFile(`${out}/report.json`,JSON.stringify({dataMode:'Synthetic provider/owner records; actual local owner-session auth and denied private routes when configured',results},null,2));
 return results;
}
