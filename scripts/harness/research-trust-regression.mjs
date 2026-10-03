import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import ts from 'typescript';
import { researchSnapshotFixture } from './research-read-fixture.mjs';

// Execute actual domain/orchestration code. Every external boundary is isolated.
const baseline = process.argv.includes('--baseline');
let fx = { currentPrice: 4.2, vol20d: .003, change: .01 };
const cache = new Map();
function load(file) {
 const absolute=path.resolve(file); if(cache.has(absolute))return cache.get(absolute).exports;
 const m={exports:{}};cache.set(absolute,m);
 const source=baseline && ['src/lib/signal.ts','src/lib/research/valuation.ts'].includes(file) ? execFileSync('git',['show',`8b492fa:${file}`],{encoding:'utf8'}) : readFileSync(absolute,'utf8');
 const stubs={
  'yahoo-finance':{fetchVIX:async()=>({price:20,change:0}),fetchIndicesWithChart:async()=>[],fetchQuotes:async()=>[],fetchHistoricalCurrencyVol:async()=>fx},
  'reddit':{fetchMultipleSubreddits:async()=>[]},'rss-feeds':{fetchMarketNews:async()=>[]},
  'stocktwits':{fetchTrendingTwits:async()=>[],calculateStockTwitsSentiment:()=>0},
  'db':{sql:async()=>[]},'institutional-service':{getLatestInstitutionalData:async()=>[]},
  'market-context':{fetchMarketContext:async market=>({market})},
  'market-indicators':{fetchBuffettIndicator:async()=>null,fetchCboePutCallRatio:async()=>null,fetchNaaimExposure:async()=>null},
  'market-calibration-service':{getMarketCalibration:async()=>undefined},
 };
 const req=id=>{const resolved=id.startsWith('@/')?path.resolve('src',id.slice(2)):path.resolve(path.dirname(absolute),id);const name=path.basename(resolved);if(stubs[name])return stubs[name];if(!id.startsWith('.')&&!id.startsWith('@/'))throw Error(`Unexpected import ${id}`);return load(path.relative(process.cwd(),resolved)+'.ts');};
 new Function('require','module','exports','fetch',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,m,m.exports,()=>{throw Error('Unexpected real network access')});return m.exports;
}
const {calculateValuation}=load('src/lib/research/valuation.ts');
for(const [fcf,expected] of [[.4,.4],[3.46,3.46],[-.4,-.4]]) {
 const actual=calculateValuation({price:1,shares:100,freeCashFlow:fcf,annualRevenue:null,annualNetIncome:null,debt:null,cash:null}).freeCashFlowYieldPercent;
 if(baseline) assert.notEqual(actual,expected); else assert.equal(actual,expected);
}
const signal=load('src/lib/signal.ts');
const my=await signal.getSmartSignal('MY','standard',false,undefined,{includeAura:false});
const indicator=my.v2.components.vix;
if(baseline){assert.equal(indicator.value,20);console.log('Reproduced: MY scores the scaled FX input 12 but displays US VIX 20; small FCF yields are rounded away.');process.exit(0);}
assert.equal(indicator.value,12);assert.match(indicator.display_name,/scaled/);assert.match(indicator.metadata.mode_note,/4000/);
fx={currentPrice:0,vol20d:0,change:0};const fallback=await signal.getSmartSignal('MY','standard',false,undefined,{includeAura:false});assert.equal(fallback.v2.components.vix.value,20);assert.match(fallback.v2.components.vix.display_name,/US VIX/);
fx={currentPrice:4,vol20d:.0001,change:0};assert.equal((await signal.fetchRawMarketData('MY',false,false)).fearGauge.value,10);
fx={currentPrice:4,vol20d:.1,change:0};assert.equal((await signal.fetchRawMarketData('MY',false,false)).fearGauge.value,80);
const {archivedSeries,indicatorStatus}=load('src/components/v8/MarketV8ConnectedData.ts');
assert.equal(indicatorStatus(my.v2,'vix','2026-10-03'),'Observation date unavailable');
assert.deepEqual(archivedSeries('vix',[{date:'2026-10-01'},{date:'2026-10-02'}],{'2026-10-01':{components:[{key:'vix',rawValue:20,displayName:'USD/MYR Volatility'}]},'2026-10-02':{components:[{key:'vix',rawValue:12,displayName:indicator.display_name}]}},indicator.display_name),[[{date:'2026-10-02',value:12}]]);
const {assessCurrentResearch}=load('src/lib/research/current-assessment.ts');
const snapshot=structuredClone(researchSnapshotFixture.data);snapshot.fetchedAt=new Date().toISOString();snapshot.quote.instrumentType='EQUITY';snapshot.quote.name='Fixture Industrial';Object.assign(snapshot.fundamentals,{source:'SEC EDGAR',reportingPeriod:'2025-12-31',revenueGrowthPercent:10,annualNetIncome:100,freeCashFlow:80});snapshot.warnings=[];
const assess=()=>assessCurrentResearch(snapshot,Date.now());assert.equal(assess().headline,'Growth and positive earnings reported');
snapshot.market='MY';snapshot.fundamentals.source='Yahoo Finance';assert.equal(assess().coverage,3);
snapshot.quote.instrumentType='ETF';assert.equal(assess().applicable,false);assert.equal(snapshot.fundamentals.annualNetIncome,100);
snapshot.quote.instrumentType=null;assert.equal(assess().applicable,false);
snapshot.quote.instrumentType='EQUITY';snapshot.quote.name='Malayan Banking Berhad';assert.equal(assess().applicable,false);
snapshot.quote.name='Fixture Industrial';snapshot.fundamentals.freeCashFlow=null;assert.equal(assess().headline,'Partial financial picture');
snapshot.fundamentals.source=null;assert.equal(assess().headline,'Not enough financial data');
const {createResearchRecord}=load('src/lib/research/records.ts');const {parseResearchRecord,parseResearchCreateInput}=load('src/lib/research/input.ts');
const bookmark=createResearchRecord(parseResearchCreateInput({symbol:'AAPL',market:'US',companyName:'Apple',saveOnly:true}));
assert.equal(bookmark.decisionJournal.decision,'Not recorded');assert.equal(bookmark.decisionJournal.confidence,'unrecorded');assert.equal(bookmark.thesisStrength,'unknown');assert.equal(bookmark.notes,'');assert.equal(bookmark.whyInterested,'');assert.deepEqual(bookmark.reviewHistory,[]);assert.equal(parseResearchRecord(bookmark).decisionJournal.decision,'Not recorded');assert.throws(()=>parseResearchCreateInput({symbol:'AAPL',market:'US',companyName:'Apple',saveOnly:'true'}));
const {parseYahooResearchChart,toYahooSymbol}=load('src/lib/research/yahoo-research.ts');assert.equal(toYahooSymbol('5347.KL','MY'),'5347.KL');
const quote=parseYahooResearchChart({chart:{result:[{meta:{instrumentType:'EQUITY',regularMarketTime:1700000000},indicators:{quote:[{close:[]}]}}]}});assert.equal(quote.observedAt,new Date(1700000000000).toISOString());assert.equal(quote.instrumentType,'EQUITY');
console.log('Research trust regression passed: rounding, real MY proxy/fallback orchestration, applicability, partial evidence, bookmark authorship, observation dates and MY suffix. No real SQL/providers.');
