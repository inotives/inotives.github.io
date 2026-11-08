// Data for the US macro regime mock (public/mocks/fred-macro.html): pulls the FRED series it uses
// and writes monthly averages to public/mocks/data/fred-macro.json.
//
//   npm run fred
//
// FRED's graph download (fredgraph.csv?id=A,B,C) needs no API key. Asking for several series
// returns a zip with one CSV per frequency, and it takes at most 12 series, so the series are split
// into the same three sets the mock offers as downloads. The parsing and monthly averaging below
// mirror `readFredFiles()` and `toMonthly()` in the mock; change both together.
import { writeFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

const START = '1990-01';
export const SETS = [
  { id: 'growth', name: 'Growth and inflation', ids: ['INDPRO', 'PAYEMS', 'ICSA', 'UNRATE', 'RSAFS', 'CPIAUCSL', 'PCEPILFE', 'T5YIE', 'USREC'] },
  { id: 'liquidity', name: 'Liquidity and rates', ids: ['FEDFUNDS', 'WALCL', 'RRPONTSYD', 'WTREGEN', 'M2SL', 'DGS10', 'DGS2', 'T10Y2Y', 'T10Y3M'] },
  { id: 'markets', name: 'Markets and stress', ids: ['BAMLH0A0HYM2', 'BAA10Y', 'NFCI', 'VIXCLS', 'DTWEXBGS', 'SP500', 'NASDAQCOM', 'DCOILWTICO', 'CBBTCUSD'] },
];
const out = new URL('../../../public/mocks/data/fred-macro.json', import.meta.url);
const fail = (msg) => { console.error(msg); process.exit(1); };

// zip → [{name, text}]; FRED's zips store sizes in the local headers (no data descriptors)
function unzip(buf) {
  const files = [];
  for (let p = 0; buf.readUInt32LE(p) === 0x04034b50;) {
    const method = buf.readUInt16LE(p + 8), size = buf.readUInt32LE(p + 18), nl = buf.readUInt16LE(p + 26), xl = buf.readUInt16LE(p + 28);
    const name = buf.toString('utf8', p + 30, p + 30 + nl), at = p + 30 + nl + xl, data = buf.subarray(at, at + size);
    files.push({ name, text: (method === 8 ? inflateRawSync(data) : data).toString('utf8') });
    p = at + size;
  }
  return files;
}
// CSV with an observation_date column and one column per series → { ID: [[yyyy-mm-dd, value], ...] }
function parseCsv(text, obs) {
  const [head, ...rows] = text.trim().split(/\r?\n/);
  const cols = head.split(',');
  if (cols[0] !== 'observation_date') return;
  for (const row of rows) {
    const cells = row.split(',');
    for (let c = 1; c < cols.length; c++) {
      const v = Number(cells[c]);
      if (cells[c] !== '' && cells[c] !== '.' && Number.isFinite(v)) (obs[cols[c]] ||= []).push([cells[0], v]);
    }
  }
}
// observations → monthly averages from START, aligned on one month axis
function toMonthly(obs) {
  const last = Object.values(obs).flat().reduce((m, [d]) => (d > m ? d : m), START);
  const months = [];
  for (let [y, m] = START.split('-').map(Number); `${y}-${String(m).padStart(2, '0')}` <= last.slice(0, 7); m === 12 ? (y++, m = 1) : m++) months.push(`${y}-${String(m).padStart(2, '0')}`);
  const at = new Map(months.map((k, i) => [k, i]));
  const series = {}, lastObs = {};
  for (const [id, list] of Object.entries(obs)) {
    const sum = new Array(months.length).fill(0), n = new Array(months.length).fill(0);
    for (const [d, v] of list) { const i = at.get(d.slice(0, 7)); if (i != null) { sum[i] += v; n[i]++; } }
    series[id] = sum.map((s, i) => (n[i] ? Number((s / n[i]).toPrecision(6)) : null));
    lastObs[id] = list.at(-1)[0];
  }
  return { start: START, months: months.length, series, last: lastObs };
}

const obs = {};
for (const set of SETS) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${set.ids.join(',')}`;
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; inotives-fred-macro)' } });
  if (!res.ok) fail(`Fetch failed: ${res.status} ${url}`);
  for (const f of unzip(Buffer.from(await res.arrayBuffer()))) if (f.name.endsWith('.csv')) parseCsv(f.text, obs);
  const missing = set.ids.filter((id) => !obs[id]?.length);
  if (missing.length) fail(`${set.name}: no observations for ${missing.join(', ')}`);
}
const data = { built: new Date().toISOString().slice(0, 10), source: 'FRED, Federal Reserve Bank of St. Louis', ...toMonthly(obs) };
await writeFile(out, JSON.stringify(data));
const latest = Object.entries(data.last).sort((a, b) => a[1].localeCompare(b[1]));
console.log(`Wrote ${data.months} months × ${Object.keys(data.series).length} series from ${START}. Oldest latest point: ${latest[0][0]} ${latest[0][1]}; newest: ${latest.at(-1)[1]}.`);
