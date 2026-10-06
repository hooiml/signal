import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import { researchSnapshotFixture } from './research-read-fixture.mjs';

function loader(overrides = {}, fetcher = () => { throw Error('Unexpected network'); }) {
 const cache=new Map();
 function load(file) {
  const absolute=path.resolve(file);if(cache.has(absolute))return cache.get(absolute).exports;
  const m={exports:{}};cache.set(absolute,m);const req=createRequire(absolute);
  const resolve=id=>{
   if(id==='next/cache')return {unstable_cache:fn=>fn};
   if(overrides[id])return overrides[id];
   if(id.startsWith('.')||id.startsWith('@/'))return load((id.startsWith('@/')?path.resolve('src',id.slice(2)):path.resolve(path.dirname(absolute),id))+'.ts');
   return req(id);
  };
  new Function('require','module','exports','fetch',ts.transpileModule(readFileSync(absolute,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(resolve,m,m.exports,fetcher);
  return m.exports;
 }return load;
}
const load=loader();const search=load('src/lib/research/security-search.ts');
const apple={symbol:'AAPL',longname:'Apple Inc.',quoteType:'EQUITY',exchange:'NMS',exchDisp:'NASDAQ',sector:'Technology',industry:'Consumer Electronics',isYahooFinance:true};
const tenaga={...apple,symbol:'5347.KL',longname:'Tenaga Nasional Berhad',exchange:'KLS',sector:'Utilities',industry:'Utilities—Regulated Electric'};
const payload={quotes:[apple,tenaga,{...apple,symbol:'AAPL.TO',exchange:'TOR'},{...apple,symbol:'BAD',quoteType:'FUTURE'},{...apple,symbol:'FAKE',isYahooFinance:false},{...apple,symbol:'../../BAD'},apple]};
assert.deepEqual(search.parseSecuritySearch(payload,'US').map(x=>x.symbol),['AAPL']);assert.deepEqual(search.parseSecuritySearch(payload,'MY').map(x=>x.symbol),['5347.KL']);
assert.equal(search.parseSecuritySearch({quotes:Array.from({length:20},(_,i)=>({...apple,symbol:`A${i}`}))},'US').length,8);
assert.throws(()=>search.parseSecuritySearch({},'US'));assert.equal(search.validSecurityQuery('Tenaga Nasional'),true);for(const q of ['', 'x'.repeat(81),'bad\nquery','https://evil.test'])assert.equal(search.validSecurityQuery(q),false);
assert.throws(()=>search.parseSecuritySearchResponse({success:true,data:search.parseSecuritySearch(payload,'MY')},'US'));
let calls=[];
const fetching=loader({},async(url,options)=>{calls.push({url,options});return Response.json(payload);});
assert.equal((await fetching('src/lib/research/security-search.ts').searchSecurities('Apple','US'))[0].symbol,'AAPL');
assert.equal(new URL(calls[0].url).origin,'https://query1.finance.yahoo.com');assert.equal(calls[0].options.redirect,'error');
const classification=fetching('src/lib/research/security-classification.ts');
assert.equal((await classification.getSecurityClassification('5347','MY')).sector,'Utilities');
assert.equal(await classification.getSecurityClassification('MSFT','US'),null,'Never borrow another result classification');
const route=fetching('src/app/api/research/search/route.ts');calls=[];assert.equal((await route.GET(new Request('http://localhost/api/research/search?q=Apple&market=GB'))).status,400);assert.equal(calls.length,0);
assert.equal((await route.GET(new Request('http://localhost/api/research/search?q=Apple&market=US'))).status,200);
const failing=loader({},async()=>{throw Error('Private provider details');});const failed=await failing('src/app/api/research/search/route.ts').GET(new Request('http://localhost/api/research/search?q=Apple&market=US'));assert.equal(failed.status,502);assert.doesNotMatch(await failed.text(),/Private/);
const assess=load('src/lib/research/current-assessment.ts').assessCurrentResearch;
const snapshot=structuredClone(researchSnapshotFixture.data);snapshot.fetchedAt=new Date().toISOString();Object.assign(snapshot.fundamentals,{source:'SEC EDGAR',reportingPeriod:'2025-12-31',revenueGrowthPercent:10,annualNetIncome:100,freeCashFlow:80});snapshot.quote.instrumentType='EQUITY';snapshot.quote.classification={source:'Yahoo Finance',instrumentType:'EQUITY',sector:'Technology',industry:'Consumer Electronics',retrievedAt:new Date().toISOString()};
assert.equal(assess(snapshot,Date.now()).applicable,true);
for(const patch of [{sector:'Financial Services',industry:'Insurance—Diversified'},{sector:'Real Estate',industry:'REIT—Retail'},{sector:'Unknown'},{industry:null},{instrumentType:'ETF'},{retrievedAt:'2020-01-01'}])assert.equal(assess({...snapshot,quote:{...snapshot.quote,classification:{...snapshot.quote.classification,...patch}}},Date.now()).applicable,false);
assert.equal(assess({...snapshot,quote:{...snapshot.quote,classification:null}},Date.now()).applicable,false);
// All independent providers start before any resolve; timings include failed stages and no identities.
let release;const hold=new Promise(resolve=>release=resolve);const started=[];
const timed=(stage,value)=>async()=>{started.push(stage);await hold;return value;};
const quote={...snapshot.quote,chart:snapshot.chart,technicals:snapshot.technicals,history:{closes:[],adjustedCloses:[],volumes:[]}};
const orchestration=loader({
 './yahoo-research':{fetchYahooResearch:timed('quote',quote)},
 './sec-edgar':{fetchSecFundamentals:timed('fundamentals',snapshot.fundamentals)},
 './security-classification':{getSecurityClassification:timed('classification',snapshot.quote.classification)},
});
const symbolRoute=orchestration('src/app/api/research/symbol/[symbol]/route.ts');const pending=symbolRoute.GET(new Request('http://localhost/api/research/symbol/AAPL?market=US'),{params:Promise.resolve({symbol:'AAPL'})});await Promise.resolve();await Promise.resolve();assert.deepEqual(started,['quote','fundamentals','quote','classification']);release();const response=await pending;assert.equal(response.status,200);
const timing=response.headers.get('server-timing');for(const stage of ['quote','fundamentals','benchmark','classification','assembly','research'])assert.match(timing,new RegExp(`${stage};dur=\\d`));assert.doesNotMatch(timing,/AAPL|Apple|http/);
console.log('Security search, exact classification, conservative eligibility and parallel stage timing regressions passed. Fixtures only.');
