import { chromium } from 'playwright';

const baseUrl = process.env.SIGNAL_QA_URL ?? 'http://127.0.0.1:3000';
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };
const review = {
    id: 'review-1', reviewedAt: '2026-08-01T00:00:00.000Z', positionState: 'not-owned', inBuyZone: false, status: 'waiting', targetBuyZone: '', valuationState: 'expensive', thesisStrength: 'medium', whyInterested: '', bullCase: '', bearCase: '', buyTrigger: '', sellTrigger: '', thesisBreak: '', notes: '',
    checklist: {}, monitoringRules: {}, acceptedEvidence: [], documentEvidence: { version: 1, migrationState: 'current', citations: [] }, factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: { decision: 'Wait for price', confidence: 'medium', observedPrice: 400, benchmarkLabel: null, benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: null, priorOutcome: 'unresolved', outcomeNote: '' },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null },
};
const record = {
    symbol: 'MSFT', market: 'US', companyName: 'Microsoft', positionState: 'not-owned', inBuyZone: false, status: 'watch', targetBuyZone: '', valuationState: 'unknown', thesisStrength: 'medium', whyInterested: '', bullCase: '', bearCase: '', buyTrigger: '', sellTrigger: '', thesisBreak: '', notes: '',
    checklist: {}, monitoringRules: {}, acceptedEvidence: [], documentEvidence: { version: 1, migrationState: 'current', citations: [] }, factorAssumptions: { version: 1, migrationState: 'current', assumptions: [] },
    decisionJournal: { decision: 'Watch', confidence: 'medium', observedPrice: 420, benchmarkLabel: null, benchmarkReturnPercent: null, nextReviewAt: null, priorReviewId: 'review-1', priorOutcome: 'unresolved', outcomeNote: '' },
    positionPlan: { plannedAllocationPercent: null, averageCost: null, plannedEntryPrice: null, invalidationPrice: null }, reviewHistory: [review], lastReviewedAt: '2026-08-20', updatedAt: '2026-08-20T00:00:00.000Z', revision: 2,
};
const snapshot = { symbol: 'MSFT', market: 'US', fetchedAt: '2026-08-30T08:00:00Z', benchmark: { baselineSymbol:'VOO', baselineName:'Vanguard S&P 500 ETF', period:'1Y', candidateReturnPercent:null, baselineReturnPercent:null, relativeReturnPercent:null, returnBasis:null, status:'unavailable' }, quote: { name:'Microsoft', currency:'USD', price:460, dailyChangePercent:1 }, fundamentals: { revenueGrowthPercent:null,grossMarginPercent:null,operatingMarginPercent:null,freeCashFlow:null,debt:null,cash:null,shares:null,annualRevenue:null,annualNetIncome:null,reportingPeriod:null,shareChangePercent:null,source:null,history:[] }, valuation:{ marketCap:null,priceEarnings:null,priceSales:null,freeCashFlowYieldPercent:null,netCash:null,reportingPeriod:null,source:null }, technicals:{ ma50:null,ma200:null,rsi14:null,macd:null,low52Week:null,high52Week:null,averageVolume20:null,support:null,resistance:null }, chart:{ interval:'1d',points:[] }, sources:['fixture'], warnings:[] };
let saved = null;

const runViewport = async (browser, viewport) => {
    const context = await browser.newContext({ viewport, colorScheme:'dark' });
    const page = await context.newPage(); const blocking=[];
    page.on('pageerror', e => blocking.push(`pageerror: ${e.message}`)); page.on('console', m => { if (m.type()==='error') blocking.push(`console: ${m.text()}`); });
    await page.route('**/api/**', async route => {
        const request=route.request(); const url=new URL(request.url()); const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
        if (url.pathname==='/api/research/watchlist') return json({success:true,data:[record],archivedSymbols:[]});
        if (url.pathname.startsWith('/api/research/symbol/')) return json({success:true,data:snapshot});
        if (url.pathname.startsWith('/api/research/calibration/')) { if (request.method()==='GET') return json({success:true,data:saved?[saved]:[]}); saved=request.postDataJSON(); return json({success:true,data:saved},201); }
        if (url.pathname.startsWith('/api/research/memory/')) return request.method()==='GET'?json({success:true,data:[]}):json({success:true,data:request.postDataJSON()},201);
        if (url.pathname.startsWith('/api/research/expectations/')) return json({success:true,data:[]});
        if (url.pathname.startsWith('/api/research/valuation-plan/')) return json({success:true,data:{ticker:'MSFT',currentEps:null,years:5,annualDiscountRatePct:10,scenarios:[{id:'bear',label:'Bear',currentEps:1,epsCagrPct:4,terminalPe:20,years:5,annualDiscountRatePct:10},{id:'base',label:'Base',currentEps:1,epsCagrPct:10,terminalPe:25,years:5,annualDiscountRatePct:10},{id:'bull',label:'Bull',currentEps:1,epsCagrPct:16,terminalPe:30,years:5,annualDiscountRatePct:10}],updatedAt:'2026-08-30T00:00:00Z'}});
        if (url.pathname==='/api/research/inbox') return json({success:true,data:{generatedAt:snapshot.fetchedAt,monitoredCount:1,items:[],warnings:[]}});
        if (url.pathname==='/api/research/quotes') return json({success:true,data:{fetchedAt:snapshot.fetchedAt,items:[]}});
        if (url.pathname.startsWith('/api/research/chart/')||url.pathname.startsWith('/api/research/quote/')) return json({success:true,data:{chart:{interval:'1d',points:[]},quote:snapshot.quote}});
        if (url.pathname.startsWith('/api/signals/')) return json({success:false,error:'not needed'},503);
        return json({success:true,data:{}});
    });
    await page.goto(`${baseUrl}/research?ticker=MSFT`, { waitUntil:'domcontentloaded' });
    await page.getByTestId('research-review-tools').getByRole('button', { name: /Decision review/ }).click();
    const panel=page.getByTestId('decision-calibration-v10'); await panel.waitFor({state:'visible',timeout:30000});
    const text=await panel.textContent();
    check(text?.includes('Wait for price'), `${viewport.width}: original decision missing`);
    check(text?.includes('$460') && text?.includes('+15.0%'), `${viewport.width}: later return context missing`);
    check(text?.includes('Review the process, not just the return.'), `${viewport.width}: process framing missing`);
    await panel.getByLabel('Thesis quality').selectOption('strong');
    await panel.getByLabel('Evidence quality').selectOption('strong');
    await panel.getByLabel('Hindsight risk').check();
    await panel.getByLabel('Unexpected information').fill('A new product catalyst emerged after the original review.');
    await panel.getByLabel('Process verdict').selectOption('adjust');
    await panel.getByRole('button',{name:'Save process review'}).click();
    await panel.getByText('Process review saved.').waitFor({state:'visible'});
    check(saved?.hindsightRisk===true, `${viewport.width}: hindsight flag not saved`);
    check(saved?.processVerdict==='adjust', `${viewport.width}: verdict not saved`);
    check(saved?.laterPrice===460, `${viewport.width}: later price context not saved`);
    const buttonBox=await panel.getByRole('button',{name:'Save process review'}).boundingBox(); check(Boolean(buttonBox&&buttonBox.height>=40), `${viewport.width}: save control touch target too small`);
    const overflow=await page.evaluate(()=>Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-window.innerWidth); check(overflow<=1, `${viewport.width}: ${overflow}px horizontal overflow`);
    check(blocking.length===0, `${viewport.width}: browser errors: ${blocking.join(' | ')}`);
    await context.close();
};
const browser=await chromium.launch({headless:true});
try { await runViewport(browser,{width:1280,height:900}); saved=null; await runViewport(browser,{width:375,height:812}); } finally { await browser.close(); }
if (failures.length){ console.error(failures.join('\n')); process.exit(1); }
console.log('research decision calibration v10 browser QA: ok');
