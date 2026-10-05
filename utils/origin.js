// ============================================================================
//  Where was this run started from?
//
//  The log is assignment evidence, so it records the network origin: the public
//  IP address of the machine, and the city / state / country that address maps
//  to. Recorded ONCE per run, in the banner.
//
//  PRIVACY: looking the location up means sending the public IP to a third
//  party (ipapi.co). Students can switch it off with LOG_GEO=false, and the run
//  continues normally - the log then says the lookup was disabled.
// ============================================================================
// Two free providers, tried in order: the first is rate limited per IP, and a
// classroom shares one public address, so a fallback matters here.
const GEO_PROVIDERS = [
  { url: 'https://ipapi.co/json/', shape: (d) => d },
  {
    url: 'http://ip-api.com/json/?fields=status,message,query,city,regionName,region,country,countryCode,zip,timezone,isp',
    shape: (d) =>
      d.status === 'fail'
        ? { error: true, reason: d.message }
        : {
            ip: d.query,
            city: d.city,
            region: d.regionName,
            region_code: d.region,
            country_name: d.country,
            country_code: d.countryCode,
            postal: d.zip,
            timezone: d.timezone,
            org: d.isp
          }
  }
];
const TIMEOUT_MS = Number(process.env.GEO_TIMEOUT_MS) || 4000;

const geoEnabled = () => !/^(false|0|no|off)$/i.test(process.env.LOG_GEO || '');

// Turn whatever the service returns into the fields we log
function describeOrigin(data = {}) {
  if (!data || data.error) return { available: false, reason: data?.reason || 'lookup failed' };
  return {
    available: true,
    ip: data.ip || null,
    city: data.city || null,
    state: data.region || null, // "Arizona"
    stateCode: data.region_code || null, // "AZ"
    country: data.country_name || null,
    countryCode: data.country_code || null,
    postal: data.postal || null,
    timezone: data.timezone || null,
    org: data.org || data.asn || null // ISP / university network
  };
}

// One line: "24.255.14.100 - Tempe, Arizona (AZ), United States - Cox Communications"
function formatOrigin(origin) {
  if (!origin?.available) return `unavailable (${origin?.reason || 'unknown'})`;
  const place = [origin.city, origin.state && `${origin.state}${origin.stateCode ? ` (${origin.stateCode})` : ''}`, origin.country]
    .filter(Boolean)
    .join(', ');
  return [origin.ip, place || 'location unknown', origin.org].filter(Boolean).join(' - ');
}

// fetcher is injectable so tests never touch the network
async function lookupOrigin({ fetcher = fetch, providers = GEO_PROVIDERS, timeoutMs = TIMEOUT_MS } = {}) {
  if (!geoEnabled()) return { available: false, reason: 'disabled with LOG_GEO=false' };

  const reasons = [];
  for (const provider of providers) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetcher(provider.url, { signal: controller.signal });
      if (!res.ok) {
        reasons.push(`HTTP ${res.status}`);
        continue;
      }
      const origin = describeOrigin(provider.shape(await res.json()));
      if (origin.available) return origin;
      reasons.push(origin.reason || 'no data');
    } catch (err) {
      // Offline, blocked, or rate limited: never let this stop the app
      reasons.push(err.name === 'AbortError' ? 'timed out' : err.message);
    } finally {
      clearTimeout(timer);
    }
  }
  return { available: false, reason: reasons.join('; ') || 'no provider answered' };
}

// The per-request client address. Behind a proxy, x-forwarded-for holds it.
function clientAddress(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const address = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  // ::1 and ::ffff:127.0.0.1 both mean "this same machine"
  return /^(::1|::ffff:127\.0\.0\.1|127\.0\.0\.1)$/.test(address) ? `${address} (localhost)` : address;
}

module.exports = { lookupOrigin, describeOrigin, formatOrigin, clientAddress, geoEnabled };
