import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { researchSnapshotFixture } from './research-read-fixture.mjs';
export function isolatedSnapshot(root = process.cwd(), delays = false) {
 const cache = new Map(); let outstanding = null; const calls=[];
 const sample = structuredClone(researchSnapshotFixture.data);
 Object.assign(sample.fundamentals,{source:'SEC EDGAR',reportingPeriod:'2025-12-31',revenueGrowthPercent:21,annualRevenue:121,annualNetIncome:20,freeCashFlow:-5,shares:900});
 const quote={...sample.quote,chart:sample.chart,technicals:sample.technicals,history:{closes:[100,110],adjustedCloses:[100,110],volumes:[],observations:[]}};
 const wait=async (name,ms,value)=>{calls.push(name);if(delays)await new Promise(r=>setTimeout(r,ms));return value;};
 const stubs={
  'yahoo-research':{fetchYahooResearch:async symbol=>wait(symbol==='VOO'?'benchmark':'quote',symbol==='VOO'?200:40,{...quote,sharesOutstanding:outstanding}),toYahooSymbol:(symbol,market)=>market==='MY'?`${symbol}.KL`:symbol},
  'sec-edgar':{fetchSecFundamentals:async()=>wait('fundamentals',60,sample.fundamentals)},
  'yahoo-fundamentals':{fetchYahooFundamentalHistory:async()=>wait('fundamentals',60,[{...sample.fundamentals,currency:'MYR',source:'Yahoo Finance',shares:900,shareBasis:'diluted average'}])},
  'security-classification':{getSecurityClassification:async()=>wait('classification',30,null)},
 };
 function load(file,stubbed=false){const absolute=path.resolve(root,file),key=absolute+stubbed;if(cache.has(key))return cache.get(key).exports;const m={exports:{}};cache.set(key,m);const req=id=>{const full=id.startsWith('@/')?path.resolve(root,'src',id.slice(2)):path.resolve(path.dirname(absolute),id),name=path.basename(full);if(stubbed&&stubs[name])return stubs[name];if(id.startsWith('.')||id.startsWith('@/'))return load(path.relative(root,full)+'.ts',stubbed);return createRequire(absolute)(id);};new Function('require','module','exports',ts.transpileModule(readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(req,m,m.exports);return m.exports;}
 return {load,calls,setOutstanding:value=>{outstanding=value;},snapshot:()=>load('src/lib/research/snapshot.ts',true)};
}
if (process.argv[1]?.endsWith('research-improvements-regression.mjs')) {
 const f=isolatedSnapshot();const parse=f.load('src/lib/research/yahoo-fundamentals.ts').parseYahooFundamentalTimeseries;
 const payload=(dates)=>({timeseries:{result:Object.entries({annualTotalRevenue:[121,100],annualNetIncome:[20,10],annualFreeCashFlow:[-5,2],annualDilutedAverageShares:[900,800]}).map(([key,values])=>({meta:{type:[key]},[key]:dates.map((asOfDate,i)=>({asOfDate,periodType:'12M',currencyCode:'MYR',reportedValue:{raw:values[i]}}))}))}});
 const missing=parse(payload(['2025-12-31','2023-12-31']),'MYR');assert.equal(missing[0].revenueGrowthPercent,null);assert.equal(missing[0].comparisonRevenue,100);assert.equal(missing[0].comparisonPeriod,'2023-12-31');assert.equal(missing[0].shareChangePercent,null);assert.equal(missing[0].shareBasis,'diluted average');
 assert.equal(parse(payload(['2025-12-31','2024-12-31']),'MYR')[0].revenueGrowthPercent,21);
 assert.equal(parse(payload(['2025-12-31','2025-06-30']),'MYR')[0].revenueGrowthPercent,null);
 const a=f.load('src/lib/research/current-assessment.ts').assessCurrentResearch;
 const s=structuredClone(researchSnapshotFixture.data);Object.assign(s,{fetchedAt:new Date().toISOString()});s.quote.instrumentType='EQUITY';s.quote.classification={source:'Yahoo Finance',instrumentType:'EQUITY',sector:'Industrials',industry:'Machinery',retrievedAt:s.fetchedAt};Object.assign(s.fundamentals,missing[0],{history:missing});assert.equal(a(s,Date.now()).coverage,2);assert.ok(!a(s,Date.now()).supporting.join(' ').includes('year over year'));
 const my=await f.snapshot().getResearchSnapshot('5347','MY',undefined,false);assert.equal(my.fundamentals.shares,900);for(const key of ['marketCap','priceEarnings','priceSales','freeCashFlowYieldPercent'])assert.equal(my.valuation[key],null);assert.ok(my.warnings.some(w=>w.includes('not substituted')));
 f.setOutstanding(1200);const compatible=await f.snapshot().getResearchSnapshot('5347','MY',undefined,false);assert.equal(compatible.valuation.marketCap,compatible.quote.price*1200);assert.equal(compatible.valuation.shareBasis,'Yahoo quote outstanding shares');
 const benchmark=f.load('src/lib/research/benchmark.ts').buildResearchBenchmark;
 const rows=Array.from({length:80},(_,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),close:100+i,adjustedClose:200+i})).filter(r=>![0,6].includes(new Date(r.date).getUTCDay()));
 const h=observations=>({history:{closes:[],adjustedCloses:[],volumes:[],observations}});
 const listing=rows.slice(20);const result=benchmark(h(listing),h(rows));assert.equal(result.windowStart,listing[0].date);assert.equal(result.windowEnd,listing.at(-1).date);assert.equal(result.returnBasis,'adjusted close');assert.equal(result.candidateReturnPercent,result.baselineReturnPercent);
 assert.equal(benchmark(h(rows.slice(-10)),h(rows)).status,'unavailable');assert.equal(benchmark(h(rows.filter((_,i)=>i%3===0)),h(rows)).status,'unavailable');
 const partial=rows.map((r,i)=>({...r,adjustedClose:i%2?null:r.adjustedClose}));assert.equal(benchmark(h(partial),h(rows)).returnBasis,'close');
 const missingSession=benchmark(h(listing.filter((_,i)=>i!==3)),h(rows));assert.equal(missingSession.commonSessions,listing.length-1);assert.equal(missingSession.candidateReturnPercent,missingSession.baselineReturnPercent);
 const boundaryRows=Array.from({length:20},(_,i)=>({date:new Date(Date.UTC(2026,0,1+Math.round(i*30/19))).toISOString().slice(0,10),close:100+i,adjustedClose:100+i}));
 assert.notEqual(benchmark(h(boundaryRows),h(boundaryRows)).status,'unavailable','20 sessions over exactly 30 days allowed');
 assert.equal(benchmark(h(boundaryRows.slice(1)),h(boundaryRows)).status,'unavailable','19 sessions withheld');
 const shortWindow=boundaryRows.map((r,i)=>({...r,date:new Date(Date.UTC(2026,0,1+Math.round(i*29/19))).toISOString().slice(0,10)}));assert.equal(benchmark(h(shortWindow),h(shortWindow)).status,'unavailable','29 day window withheld');
 const parseChart=f.load('src/lib/research/yahoo-research.ts').parseYahooResearchChart;
 const chart=parseChart({chart:{result:[{meta:{currency:'MYR',sharesOutstanding:1200},timestamp:[1767225600,1767312000,1767398400],indicators:{quote:[{open:[1,2,3],high:[1,2,3],low:[1,2,3],close:[1,null,3],volume:[1,2,3]}],adjclose:[{adjclose:[1,2,null]}]}}]}});assert.deepEqual(chart.history.observations.map(r=>[r.date,r.close,r.adjustedClose]),[['2026-01-01',1,1],['2026-01-02',null,2],['2026-01-03',3,null]]);assert.equal(chart.sharesOutstanding,1200);
 const route=f.load('src/app/api/research/benchmark/[symbol]/route.ts',true);
 const context=symbol=>({params:Promise.resolve({symbol})});
 const count=f.calls.length;assert.equal((await route.GET(new Request('http://localhost/api/research/benchmark/AAPL?market=MY'),context('AAPL'))).status,400);assert.equal(f.calls.length,count,'invalid market never calls providers');
 assert.equal((await route.GET(new Request('http://localhost/api/research/benchmark/AAPL?market=US'),context('invalid?'))).status,400);
 const benchmarkResponse=await route.GET(new Request('http://localhost/api/research/benchmark/AAPL?market=US'),context('AAPL'));assert.equal(benchmarkResponse.status,200);assert.equal((await benchmarkResponse.json()).data.status,'unavailable');
 const timings=[];for(const include of [true,false]){const fixture=isolatedSnapshot(process.cwd(),true);const start=performance.now();await fixture.snapshot().getResearchSnapshot('AAPL','US',undefined,include);timings.push({include,ms:Math.round(performance.now()-start),calls:fixture.calls});}assert.ok(!timings[1].calls.includes('benchmark'));console.log('Research improvements regression passed',JSON.stringify(timings));
}
