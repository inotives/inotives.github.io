// Captures the snapshot for the Fertility extinction clock mock (public/mocks/world-fertility.html).
//
//   node scripts/mocks/world-fertility/capture.mjs
//
// The loader lives in the mock itself, between the `// <wb-data>` markers, so the page's
// "Go live" sync and this snapshot always share one data shape. This script imports that block,
// runs it, and writes public/mocks/data/world-fertility.json. It also runs the page's cohort
// model (between the `// <cohort-model>` markers) over a few countries as a sanity check.
// Source: World Bank API (World Development Indicators). No API key needed.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const page = new URL('public/mocks/world-fertility.html', root);
const out = new URL('public/mocks/data/world-fertility.json', root);

const html = await readFile(page, 'utf8');
const pick = (name, symbol) => {
  const m = html.match(new RegExp(`// <${name}>([\\s\\S]*?)// </${name}>`));
  if (!m) throw new Error(`${name} block not found in world-fertility.html`);
  return import(`data:text/javascript;base64,${Buffer.from(`${m[1]}\nexport default ${symbol};\n`).toString('base64')}`).then((x) => x.default);
};
const WB = await pick('wb-data', 'WB_DATA');
const COHORT = await pick('cohort-model', 'COHORT');

const t0 = Date.now();
const snap = await WB.load().catch((err) => { console.error(`capture failed: ${err.message}`); process.exit(1); });
const usable = snap.countries.filter(COHORT.usable);
console.log(`loaded ${snap.countries.length} countries (${usable.length} with age structure and mortality) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const missing = snap.countries.filter((c) => !COHORT.usable(c)).map((c) => c.iso3);
if (missing.length) console.log(`no model for: ${missing.join(' ')}`);

const json = JSON.stringify(snap);
await writeFile(out, json);
console.log(`wrote ${out.pathname.split('/public/')[1]}: ${Math.round(json.length / 1024)} KB\n`);

const last = (s) => s?.v.findLast((v) => v != null);
for (const iso of ['KOR', 'SGP', 'JPN', 'ITA', 'CHN', 'USA', 'IND', 'NGA', 'WLD']) {
  const c = snap.countries.find((x) => x.iso3 === iso);
  if (!c || !COHORT.usable(c)) { console.log(`${iso}  no data`); continue; }
  const s = COHORT.summarize(c, last(c.tfr));
  const y = (v) => (v == null ? '-' : Math.round(v));
  console.log(`${iso}  tfr ${last(c.tfr).toFixed(2)}  repl ${s.replacement.toFixed(2)}  nrr ${s.nrr.toFixed(2)}  p0 ${(s.p0 / 1e6).toFixed(1)}M  peak ${s.peak.year}  half ${y(s.half)}  1M ${y(s.million)}  end ${s.grows ? 'never' : y(s.end)}`);
}
