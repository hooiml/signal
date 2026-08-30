import { chromium } from 'playwright';

const baseUrl = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const record = {
    symbol: 'MSFT', market: 'US', companyName: 'Microsoft', positionState: 'not-owned', inBuyZone: false, status: 'watch', targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium', whyInterested: '', bullCase: '', bearCase: '', buyTrigger: '', sellTrigger: '', thesisBreak: '', notes: '',
    checklist: {}, monitoringRules: {}, acceptedEvidence: [], documentEvidence: { version: 1, migrationState: 'current', citations: [] }, factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: { decision: 'Watch', confidence: 'medium', observedPrice: null, benchmarkLabel: null, benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null, priorOutcome: 'unresolved', outcomeNote: '' },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null }, reviewHistory: [], lastReviewedAt: '2026-08-20', updatedAt: '2026-08-20T00:00:00.000Z', revision: 1,
};
const snapshot = { symbol: 'MSFT', market: 'US', fetchedAt: '2026-08-30T08:00:00Z', benchmark:{baselineSymbol:'VOO',baselineName:'Vanguard S&P 500 ETF',period:'1Y',candidateReturnPercent:null,baselineReturnPercent:null,relativeReturnPercent:null,returnBasis:null,status:'unavailable'}, quote:{name:'Microsoft',currency:'USD',price:460,dailyChangePercent:1}, fundamentals:{revenueGrowthPercent:null,grossMarginPercent:null,operatingMarginPercent:null,freeCashFlow:null,debt:null,cash:null,shares:null,annualRevenue:null,annualNetIncome:null,reportingPeriod:null,shareChangePercent:null,source:null,history:[]}, valuation:{marketCap:null,priceEarnings:null,priceSales:null,freeCashFlowYieldPercent:null,netCash:null,reportingPeriod:null,source:null}, technicals:{ma50:null,ma200:null,rsi14:null,macd:null,low52Week:null,high52Week:null,averageVolume20:null,support:null,resistance:null}, chart:{interval:'1d',points:[]}, sources:['fixture'], warnings:[] };
const item = (id, kind, title, source, proximity) => ({ id, symbol:'MSFT', kind, urgency:'action', title, detail:`${title} detail`, proximity, source, eventDate:null, structuredTriggerRuleId:null });
const attentionItems = [
    item('risk','risk','Large daily move','Yahoo Finance','-9.0% today'),
    item('expectation','expectation','Complete expectation vs reality','Expectation journal','1 day after event'),
    item('decision','decision','Review the prior decision process','Decision review','30 days since saved review'),
    item('valuation','valuation','Complete valuation evidence input','Valuation plan','EPS input missing'),
];

const runViewport = async (browser, viewport) => {
    const context = await browser.newContext({ viewport, colorScheme:'dark' });
    const page = await context.newPage(); const blocking=[];
    page.on('pageerror', e=>blocking.push(`pageerror: ${e.message}`)); page.on('console', m=>{ if(m.type()==='error') blocking.push(`console: ${m.text()}`); });
    await page.route('**/api/**', async route => {
        const request=route.request(); const url=new URL(request.url()); const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
        if(url.pathname==='/api/research/watchlist') return json({success:true,data:[record],archivedSymbols:[]});
        if(url.pathname==='/api/research/inbox') return json({success:true,data:{generatedAt:'2026-08-30T08:00:00Z',monitoredCount:1,items:attentionItems,warnings:[]}});
        if(url.pathname.startsWith('/api/research/symbol/')) return json({success:true,data:snapshot});
        if(url.pathname.startsWith('/api/research/memory/')) return request.method()==='GET'?json({success:true,data:[]}):json({success:true,data:request.postDataJSON()},201);
        if(url.pathname.startsWith('/api/research/expectations/')) return json({success:true,data:[]});
        if(url.pathname.startsWith('/api/research/valuation-plan/')) return json({success:true,data:{ticker:'MSFT',currentEps:null,years:5,annualDiscountRatePct:10,scenarios:[{id:'bear',label:'Bear',currentEps:1,epsCagrPct:4,terminalPe:20,years:5,annualDiscountRatePct:10},{id:'base',label:'Base',currentEps:1,epsCagrPct:10,terminalPe:25,years:5,annualDiscountRatePct:10},{id:'bull',label:'Bull',currentEps:1,epsCagrPct:16,terminalPe:30,years:5,annualDiscountRatePct:10}],updatedAt:'2026-08-30T00:00:00Z'}});
        if(url.pathname.startsWith('/api/research/calibration/')) return json({success:true,data:[]});
        if(url.pathname==='/api/research/quotes') return json({success:true,data:{fetchedAt:snapshot.fetchedAt,items:[]}});
        if(url.pathname.startsWith('/api/research/chart/')||url.pathname.startsWith('/api/research/quote/')) return json({success:true,data:{chart:{interval:'1d',points:[]},quote:snapshot.quote}});
        if(url.pathname.startsWith('/api/signals/')) return json({success:false,error:'not needed'},503);
        return json({success:true,data:{}});
    });
    await page.goto(`${baseUrl}/research?ticker=MSFT&workspace=today`, {waitUntil:'domcontentloaded'});
    const daily=page.getByText('Daily attention',{exact:true}); await daily.waitFor({state:'visible',timeout:30000});
    const section=daily.locator('xpath=ancestor::section[1]');
    const text=await section.textContent();
    for(const expected of ['Large daily move','Complete expectation vs reality','Review the prior decision process','Complete valuation evidence input','Expectation','Valuation','Decision review']) check(text?.includes(expected), `${viewport.width}: missing ${expected}`);
    const indices=attentionItems.map(entry=>text?.indexOf(entry.title)??-1); check(indices.every((value,index)=>value>=0&&(index===0||value>indices[index-1])), `${viewport.width}: attention items are not in ranked order`);
    check(text?.includes('4 unread')&&text?.includes('4 attention items'), `${viewport.width}: attention summary count incorrect`);
    const actionFilter=section.getByRole('button',{name:/Action needed · 4/}); const filterBox=await actionFilter.boundingBox(); check(Boolean(filterBox&&filterBox.height>=40), `${viewport.width}: action filter touch target too small`);
    const markSeen=section.getByRole('button',{name:'Mark all seen'}); await markSeen.click(); await page.waitForTimeout(50); check((await section.textContent())?.includes('0 unread'), `${viewport.width}: mark-all-seen did not update unread count`);
    const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth); check(overflow<=1, `${viewport.width}: ${overflow}px horizontal overflow`);
    check(blocking.length===0, `${viewport.width}: browser errors: ${blocking.join(' | ')}`);
    await context.close();
};
const browser=await chromium.launch({headless:true});
try{await runViewport(browser,{width:1280,height:900});await runViewport(browser,{width:375,height:812});}finally{await browser.close();}
if(failures.length){console.error(failures.join('\n'));process.exit(1);} console.log('research attention v11 browser QA: ok');
