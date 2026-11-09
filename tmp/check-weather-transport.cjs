// Read-only request diagnostics. Never prints a credential or credential-bearing URL.
const https = require('node:https');
const key = require('dotenv').config({ quiet: true }).parsed.OPENWEATHERMAP_API_KEY;
const describe = (raw, status, headers) => ({ status, server: headers.server, via: headers.via,
  contentType: headers['content-type'], responseDate: headers.date, errorCode: raw.cod,
  message: typeof raw.message === 'string' ? raw.message.slice(0, 180) : undefined,
  fields: Object.keys(raw), dailyCount: raw.daily?.length, hourlyCount: raw.hourly?.length,
  currentTemp: raw.current?.temp, dailyTemps: raw.daily?.[0]?.temp });
async function check(exclude) {
  const url = new URL('https://api.openweathermap.org/data/3.0/onecall');
  for (const [k,v] of Object.entries({lat:-34.05,lon:18.78,units:'metric',appid:key})) url.searchParams.set(k,v);
  if (exclude) url.searchParams.set('exclude','minutely,alerts');
  const response = await fetch(url); const raw = await response.json();
  console.log(JSON.stringify({ transport:'fetch', exclude, ...describe(raw, response.status, Object.fromEntries(response.headers)) },null,2));
  if (exclude) await new Promise((resolve, reject) => {
    const req = https.get(url, res => {
      const certificate = res.socket?.getPeerCertificate?.();
      const transport = { socketType: res.socket?.constructor?.name, encrypted: res.socket?.encrypted, issuer: certificate?.issuer?.O,
        issuerName: certificate?.issuer?.CN, subject: certificate?.subject?.CN, authorizationError: res.socket?.authorizationError };
      let data=''; res.on('data', chunk => data+=chunk);
      res.on('end', () => { try { console.log(JSON.stringify({ transport:'https', tls:transport,
        ...describe(JSON.parse(data), res.statusCode, res.headers) },null,2)); resolve(); } catch { reject(new Error('Invalid response')); } });
    });
    req.setTimeout(15000, () => req.destroy(new Error('Timeout'))); req.on('error', reject);
  });
}
(async () => { if (!key) throw new Error('Missing key'); console.log(JSON.stringify({nodePreloadConfigured:!!process.env.NODE_OPTIONS,
  proxyConfigured:!!(process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.ALL_PROXY),keyLooksLikeApiKey:/^[a-f0-9]{32}$/i.test(key)})); await check(true); })()
  .catch(error => { console.error('Transport diagnostic failed:',error.code || error.name); process.exitCode=1; });
