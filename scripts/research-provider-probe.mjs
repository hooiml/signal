const cases = ['Apple', 'Tenaga', 'Maybank', 'Berkshire', 'Realty Income'];
for (const query of cases) {
 try {
  const params = new URLSearchParams({q:query,quotesCount:'8',newsCount:'0',enableFuzzyQuery:'false'});
  const response=await fetch(`https://query1.finance.yahoo.com/v1/finance/search?${params}`,{headers:{'User-Agent':'Mozilla/5.0 Signal research dashboard'},signal:AbortSignal.timeout(10000)});
  const payload=await response.json();
  console.log(JSON.stringify({query,status:response.status,quotes:payload.quotes}));
 } catch(error) { console.log(JSON.stringify({query,error:error.message})); }
}
