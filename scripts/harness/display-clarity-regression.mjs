import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function load(file) {
 const compiledModule = {exports:{}};
 const code = ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},fileName:file}).outputText;
 new Function('exports','module',code)(compiledModule.exports,compiledModule);
 return compiledModule.exports;
}
const {
 compactFinancialAmount:format,
 annualAmountComparison:compare,
 financialPercentage:percentage,
 annualHistorySeries:series,
 positionPlanPriceContext:planContext,
} = load('src/lib/research/financial-display.ts');
assert.equal(percentage(6.431),'6.43%');
assert.equal(percentage(-9.234),'-9.23%');
assert.equal(percentage(0),'0%');
assert.equal(percentage(19.5),'19.5%');
for(const bad of [null,undefined,NaN,Infinity,-Infinity])assert.equal(percentage(bad),'Unavailable');
const {marketReadingLabel:label,marketReadingSummary:summary,marketAlignment:alignment} = load('src/lib/market-display.ts');
assert.equal(format(67723100000,'MYR'),'MYR 67.72 billion');
assert.equal(format(-439700000,'MYR'),'MYR -439.7 million');
assert.equal(format(0,'USD'),'USD 0');
assert.equal(format(342.01,'USD'),'USD 342.01');
assert.equal(format(50,null),'Currency not supplied 50');
for(const bad of [null,undefined,NaN,Infinity,-Infinity])assert.equal(format(bad,'USD'),'Unavailable');
const row=(reportingPeriod,value)=>({reportingPeriod,currency:'MYR',source:'Yahoo Finance',annualRevenue:value,annualNetIncome:value,freeCashFlow:value});
function sample(previous=100,current=120) {return {source:'Yahoo Finance',reportingPeriod:'2025-12-31',annualRevenue:current,annualNetIncome:current,freeCashFlow:current,history:[row('2025-12-31',current),row('2024-12-31',previous)]};}
const original=sample(),serialized=JSON.stringify(original);
assert.equal(compare(original,'annualRevenue').percentage,20);
assert.equal(JSON.stringify(original),serialized,'Comparison does not mutate provider data.');
assert.equal(compare(sample(0,120),'freeCashFlow').percentage,null);
assert.equal(compare(sample(-100,120),'freeCashFlow').percentage,null);
assert.equal(compare(sample(-100,120),'freeCashFlow').delta,220);
assert.ok(Math.abs(compare(sample(100,-120),'freeCashFlow').percentage + 220) < 1e-10, 'Floating-point arithmetic retains the expected signed percentage.');
for(const mutate of [
 f=>f.history[1].currency='USD',f=>f.history[1].source='SEC EDGAR',
 f=>f.history[1].reportingPeriod='2023-12-31',f=>f.history[1].reportingPeriod='2025-09-30',
 f=>f.history[0].comparableAnnual=false,f=>f.history.push({...f.history[0]}),
 f=>f.history.push({...f.history[1]}),f=>f.annualRevenue=999,
 f=>f.history[0].currency='',f=>f.history[0].annualRevenue=NaN,
 f=>f.history[1].annualRevenue=null,f=>f.source=null,
]){const f=sample();mutate(f);assert.equal(compare(f,'annualRevenue'),null);}
for(const daySpan of [350,364,365,371,380]) {
 const f=sample();f.history[1].reportingPeriod=new Date(Date.parse('2025-12-31')-daySpan*86400000).toISOString().slice(0,10);
 assert.ok(compare(f,'annualRevenue'));
}
// Multi-year annual history series contracts
const multiYear = {
 source:'SEC EDGAR',
 reportingPeriod:'2025-12-31',
 annualRevenue:300,
 annualNetIncome:50,
 freeCashFlow:40,
 history:[
  {reportingPeriod:'2025-12-31',currency:'USD',source:'SEC EDGAR',annualRevenue:300,annualNetIncome:50,freeCashFlow:40},
  {reportingPeriod:'2023-12-31',currency:'USD',source:'SEC EDGAR',annualRevenue:200,annualNetIncome:-25,freeCashFlow:0},
  {reportingPeriod:'2024-12-31',currency:'USD',source:'SEC EDGAR',annualRevenue:250,annualNetIncome:30,freeCashFlow:20},
 ],
};
const multiYearCopy = JSON.stringify(multiYear);
const revSeries = series(multiYear,'annualRevenue');
assert.ok(revSeries);
assert.equal(revSeries.currency,'USD');
assert.equal(revSeries.source,'SEC EDGAR');
assert.deepEqual(revSeries.points.map(p=>p.reportingPeriod),['2023-12-31','2024-12-31','2025-12-31']);
assert.equal(revSeries.points[2].heightPercent,100);
assert.equal(revSeries.hasNegative,false);
const niSeries = series(multiYear,'annualNetIncome');
assert.ok(niSeries);
assert.equal(niSeries.hasNegative,true);
assert.deepEqual(niSeries.points.map(p=>p.sign),['negative','positive','positive']);
assert.equal(JSON.stringify(multiYear),multiYearCopy,'annualHistorySeries does not mutate input');
// Reject single period, skipped year, duplicate period, or currency mismatch
assert.equal(series({...multiYear,history:[multiYear.history[0]]},'annualRevenue'),null);
assert.equal(series({...multiYear,history:[multiYear.history[0],{...multiYear.history[1],reportingPeriod:'2022-12-31'}]},'annualRevenue'),null);
assert.equal(series({...multiYear,history:[...multiYear.history,{...multiYear.history[0]}]},'annualRevenue'),null);
// Position plan vs live price context contracts
const plan = {currency:'USD',plannedEntryPrice:180,averageCost:190,invalidationPrice:160};
const quote = {price:200,currency:'USD'};
const bounds = {low52Week:150,high52Week:220};
const planSnap = JSON.stringify({plan,quote,bounds});
const ctx = planContext(plan,quote,bounds);
assert.ok(ctx);
assert.equal(ctx.currency,'USD');
assert.equal(ctx.distances.plannedEntryPercent,-10);
assert.equal(ctx.distances.averageCostPercent,-5);
assert.equal(ctx.distances.invalidationPercent,-20);
assert.equal(ctx.markers.length,6);
assert.ok(ctx.markers.every(m=>m.offsetPercent>=2&&m.offsetPercent<=98));
assert.equal(JSON.stringify({plan,quote,bounds}),planSnap,'positionPlanPriceContext does not mutate input');
assert.equal(planContext({...plan,currency:'MYR'},quote,bounds),null,'Cross-currency plan comparison must be withheld');
assert.equal(planContext({...plan,currency:null},quote,bounds),null,'Unrecorded plan currency must be withheld');
assert.equal(planContext(plan,{price:0,currency:'USD'},bounds),null,'Non-positive quote price must be withheld');

const signal={tier:'neutral',mode:'standard',components:{a:{enabled:true,weight:.35,signal:'buy'},b:{enabled:true,weight:.2,signal:'neutral'},c:{enabled:true,weight:.1,signal:'neutral'}},confidence:{source_count:3,majority_signal:'NEUTRAL',agreement_pct:67}};
const immutable=JSON.stringify(signal);
assert.equal(alignment(signal).summary,'Indicator alignment · 2 of 3 match this reading');
assert.match(summary(signal),/1 positive, 2 neutral under Momentum/);
assert.doesNotMatch(summary(signal),/volatility|scale out|entries|opportunity/i);
assert.equal(JSON.stringify(signal),immutable);
for(const tier of ['strong-buy','buy','neutral','sell','strong-sell'])for(const mode of ['standard','contrarian']) {
 assert.ok(label(tier));assert.doesNotMatch(label(tier),/buy|sell/i);
 assert.match(summary({...signal,tier,mode}),mode==='standard'?/Momentum/:/Contrarian/);
}
for(const count of [0,1]) {
 const limited={...signal,components:Object.fromEntries(Object.entries(signal.components).slice(0,count))};
 assert.match(alignment(limited).summary,/agreement cannot be assessed/);
 assert.doesNotMatch(alignment(limited).summary,/100%/);
}
for(const patch of [{source_count:6},{agreement_pct:100},{majority_signal:'SELL'}])assert.match(alignment({...signal,confidence:{...signal.confidence,...patch}}).summary,/need checking/);
assert.match(alignment({...signal,components:{...signal.components,d:{enabled:true,weight:0,signal:'sell'},e:{enabled:false,weight:.5,signal:'sell'}}}).summary,/2 of 3/);
console.log('Display clarity contracts passed: labels, alignment, exact/compact amounts, guarded annual comparisons, multi-year series, plan-price context and immutability.');
