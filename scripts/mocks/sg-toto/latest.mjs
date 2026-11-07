// Per-draw update for the ToTo stats mock (public/mocks/sg-toto.html): merges the latest draws from
// Singapore Pools' results page into public/mocks/data/sg-toto.json.
//
//   npm run toto:latest
//
// The page lists only the most recent few draws, so this adds new draws, fills in prize figures that
// were missing, and checks the overlapping draws against the file. For backfilling a gap or a full
// reset, use the historical CSV instead: `npm run toto -- path/to/ToTo.csv` (build.mjs).
//
// Exit codes: 0 updated or nothing to do; 1 fetch/parse failure, mismatch, or a gap that needs the CSV.
// Prints `changed=true|false` last, so CI can decide whether to commit.
import { readFile, writeFile } from 'node:fs/promises';

const URL_TOP = 'https://www.singaporepools.com.sg/DataFileArchive/Lottery/Output/toto_result_top_draws_en.html';
const out = new URL('../../../public/mocks/data/sg-toto.json', import.meta.url);
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const fail = (msg) => { console.error(msg); process.exit(1); };

const res = await fetch(URL_TOP, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; inotives-toto-update)' } });
if (!res.ok) fail(`Fetch failed: ${res.status} ${URL_TOP}`);
const text = (await res.text()).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');

// Compact form, same as build.mjs/toCompact: [draw, date, n1..n6, add, [winners, prize] x 7 | 0]
const amount = (s) => (s === '-' ? 0 : Number(s.replace(/[$,]/g, '')));
const page = [];
const re = /\w{3}, (\d{2}) (\w{3}) (\d{4}) Draw No\. (\d+) Winning Numbers ([\d ]+?) Additional Number (\d+)(.*?)Winning Ticket Details/g;
for (const m of text.matchAll(re)) {
  const [, dd, mon, yyyy, draw, nums, add, rest] = m;
  const n = nums.trim().split(' ').map(Number).sort((a, b) => a - b);
  const all = [...n, Number(add)];
  if (n.length !== 6 || all.some((x) => !Number.isInteger(x) || x < 1 || x > 49) || new Set(all).size !== 7) fail(`Draw ${draw}: unexpected numbers ${all.join(' ')}`);
  const groups = [...rest.matchAll(/Group (\d) (\$[\d,]+|-) ([\d,]+|-)/g)];
  let prizes = 0;
  if (groups.length === 7) prizes = groups.flatMap((g) => [amount(g[3]), amount(g[2])]);
  else if (groups.length) fail(`Draw ${draw}: found ${groups.length} prize groups, expected 7`);
  const date = `${yyyy}-${String(MONTHS[mon]).padStart(2, '0')}-${dd}`;
  page.push([Number(draw), date, ...n, Number(add), prizes]);
}
if (!page.length) fail('No draws found on the results page; its layout may have changed.');
page.sort((a, b) => a[0] - b[0]);

const data = JSON.parse(await readFile(out, 'utf8'));
const byDraw = new Map(data.draws.map((d) => [d[0], d]));
const last = data.draws.at(-1)[0];
const fresh = page.filter((p) => p[0] > last);
if (fresh.length && fresh[0][0] !== last + 1) fail(`Gap: file ends at draw ${last}, page starts new draws at ${fresh[0][0]}. Backfill with the historical CSV (npm run toto -- ToTo.csv).`);

let changed = false;
const fmt = (d) => `${d[0]} (${d[1]}): ${d.slice(2, 8).join(' ')} +${d[8]}`;
for (const p of page) {
  const o = byDraw.get(p[0]);
  if (!o) {
    data.draws.push(p); changed = true;
    console.log(`  new      ${fmt(p)}${p[9] ? '' : ' (no prize figures yet)'}`);
    continue;
  }
  if (JSON.stringify(o.slice(0, 9)) !== JSON.stringify(p.slice(0, 9))) fail(`  MISMATCH ${fmt(p)} (file has ${fmt(o)}). Check, then reset from the CSV if needed.`);
  if (!o[9] && p[9]) { o[9] = p[9]; changed = true; console.log(`  prizes   ${p[0]}: prize figures added`); }
  else if (o[9] && p[9] && JSON.stringify(o[9]) !== JSON.stringify(p[9])) { o[9] = p[9]; changed = true; console.log(`  prizes   ${p[0]}: prize figures corrected`); }
}

if (changed) {
  data.draws.sort((a, b) => a[0] - b[0]);
  data.built = new Date().toISOString().slice(0, 10);
  await writeFile(out, JSON.stringify(data));
  const l = data.draws.at(-1);
  console.log(`${data.draws.length} draws, latest ${fmt(l)}. Wrote public/mocks/data/sg-toto.json`);
} else {
  console.log(`No changes: file already has draws up to ${last} with page's prize figures.`);
}
console.log(`changed=${changed}`);
