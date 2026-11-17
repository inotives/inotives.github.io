// Per-draw update for the ToTo stats mock (public/mocks/sg-toto.html): merges the latest draws from
// Singapore Pools' results pages into public/mocks/data/sg-toto.json.
//
//   npm run toto:latest
//
// Runs in Build and Deploy before every build, so the deployed data stays current even when the
// committed JSON falls behind: the committed file is only the base history. The top-draws page lists
// the most recent few draws; any draws between the file's last draw and those are fetched one by one
// from the per-draw results page. Also fills in prize figures that were missing and checks
// overlapping draws against the file. For a full reset, use the historical CSV instead:
// `npm run toto -- path/to/ToTo.csv` (build.mjs).
//
// Exit codes: 0 updated or nothing to do; 1 fetch/parse failure or mismatch (the file is left as is).
// Prints `changed=true|false` last.
import { readFile, writeFile } from 'node:fs/promises';

const HOST = 'https://www.singaporepools.com.sg';
const URL_TOP = `${HOST}/DataFileArchive/Lottery/Output/toto_result_top_draws_en.html`;
// The per-draw page takes the draw as base64 of "DrawNumber=NNNN" in its `sppl` query parameter.
const urlDraw = (n) => `${HOST}/en/product/sr/Pages/toto_results.aspx?sppl=${Buffer.from(`DrawNumber=${n}`).toString('base64')}`;
const MAX_BACKFILL = 60; // ~30 weeks of draws; past that, reset from the CSV instead
const out = new URL('../../../public/mocks/data/sg-toto.json', import.meta.url);
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const fail = (msg) => { console.error(msg); process.exit(1); };

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; inotives-toto-update)' } });
  if (!res.ok) fail(`Fetch failed: ${res.status} ${url}`);
  return (await res.text()).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
}

// Compact form, same as build.mjs/toCompact: [draw, date, n1..n6, add, [winners, prize] x 7 | 0]
const amount = (s) => (s === '-' ? 0 : Number(s.replace(/[$,]/g, '')));
function parseDraws(text) {
  const draws = [];
  // The top-draws page ends each draw at "Winning Ticket Details"; the per-draw page lists the
  // winning outlets and then "Prizes not claimed by ...". Outlet lines ("Group 1 winning tickets
  // sold at") don't match the prize-group pattern below.
  const re = /\w{3}, (\d{2}) (\w{3}) (\d{4}) Draw No\. (\d+) Winning Numbers ([\d ]+?) Additional Number (\d+)(.*?)(?:Winning Ticket Details|Prizes not claimed)/g;
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
    draws.push([Number(draw), date, ...n, Number(add), prizes]);
  }
  return draws;
}

const page = parseDraws(await fetchText(URL_TOP));
if (!page.length) fail('No draws found on the results page; its layout may have changed.');
page.sort((a, b) => a[0] - b[0]);

const data = JSON.parse(await readFile(out, 'utf8'));
const byDraw = new Map(data.draws.map((d) => [d[0], d]));
const last = data.draws.at(-1)[0];

// Draws between the file and the top-draws page, from the per-draw page.
const firstOnPage = page[0][0];
if (firstOnPage > last + 1) {
  const missing = firstOnPage - last - 1;
  if (missing > MAX_BACKFILL) fail(`Gap of ${missing} draws (${last + 1}-${firstOnPage - 1}) is over ${MAX_BACKFILL}; reset from the historical CSV (npm run toto -- ToTo.csv).`);
  console.log(`  backfill draws ${last + 1}-${firstOnPage - 1} from the per-draw page`);
  for (let n = last + 1; n < firstOnPage; n++) {
    const d = parseDraws(await fetchText(urlDraw(n))).find((x) => x[0] === n);
    if (!d) fail(`Draw ${n}: not found on its results page (${urlDraw(n)}); its layout may have changed.`);
    page.push(d);
  }
  page.sort((a, b) => a[0] - b[0]);
}

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
