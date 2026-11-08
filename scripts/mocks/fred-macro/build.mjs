// Updates the bundled data for the US macro regimes mock (public/mocks/fred-macro.html) from FRED.
//
//   npm run fred                                   download the three FRED sets, then update
//   npm run fred -- path/to/a.zip path/to/b.csv    update from files you already downloaded
//   node scripts/mocks/fred-macro/build.mjs …
//
// FRED's graph download (fredgraph.csv?id=A,B,C) needs no API key. Several series come back as a
// zip with one CSV per frequency, at most 12 series per request, so the 27 series are split into
// the three sets the mock links under "Update from FRED". Downloads are kept in
// .cache/fred-macro/ (gitignored). Files can also be the zips from the mock's links or
// single-series CSVs from a FRED series page.
//
// The parser lives in the mock itself, between the `// <fred-files>` markers, so this script and
// the page's "Update data" read FRED's files the same way. Series in the files replace the ones in
// the JSON; series they don't carry are kept.
//
// Reports new months, each series whose latest observation moved, and past values FRED revised.
// Writes public/mocks/data/fred-macro.json only when something changed. Prints `changed=true|false`
// last, so CI can decide whether to commit. Exit 1 on a failed download or unreadable files.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const root = new URL('../../../', import.meta.url);
const page = new URL('public/mocks/fred-macro.html', root);
const out = new URL('public/mocks/data/fred-macro.json', root);
const cache = new URL('.cache/fred-macro/', root);
const fail = (msg) => { console.error(msg); process.exit(1); };

const html = await readFile(page, 'utf8');
const block = html.match(/\/\/ <fred-files>\n([\s\S]*?)\/\/ <\/fred-files>/);
if (!block) fail('fred-files block not found in fred-macro.html');
const src = `${block[1]}\nexport default { SETS, KNOWN, setUrl, readFredFiles, toMonthly, mergeRaw, newest };\n`;
const { default: F } = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);

// 1. the files: given on the command line, or downloaded now
let paths = process.argv.slice(2);
if (!paths.length) {
  await mkdir(cache, { recursive: true });
  for (const set of F.SETS) {
    const url = F.setUrl(set);
    const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; inotives-fred-macro)' } });
    if (!res.ok) fail(`Download failed: ${res.status} ${url}`);
    const file = new URL(`${set.id}.zip`, cache);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    paths.push(file.pathname);
    console.log(`downloaded ${set.name} (${set.ids.length} series) → .cache/fred-macro/${set.id}.zip`);
  }
}
const files = [];
for (const p of paths) {
  try { files.push(new File([await readFile(p)], basename(p))); } catch { fail(`Couldn't read ${p}\nusage: npm run fred [-- file.zip file.csv …]`); }
}

// 2. parse with the mock's own reader, keeping only series the mock uses
const obs = await F.readFredFiles(files);
const ids = Object.keys(obs).filter((k) => F.KNOWN.has(k)).sort();
if (!ids.length) fail('No series the mock uses were in those files.');
const missing = [...F.KNOWN].filter((k) => !ids.includes(k));
if (!process.argv[2] && missing.length) fail(`The FRED downloads lack ${missing.join(', ')}; check the series ids in SETS.`);

// 3. merge into the current file and compare
let before = null;
try { before = JSON.parse(await readFile(out, 'utf8')); } catch { /* first build */ }
const fresh = F.toMonthly(Object.fromEntries(ids.map((k) => [k, obs[k]])));
const after = F.mergeRaw(before, fresh);

const label = (i) => { const t = 1990 * 12 + i; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
const lines = [];
if (!before) lines.push('No previous file: wrote a fresh one.');
else {
  if (after.months > before.months) lines.push(`  months   ${label(before.months - 1)} → ${label(after.months - 1)} (+${after.months - before.months})`);
  for (const id of ids) {
    const was = before.last?.[id], now = after.last[id];
    if (!was) { lines.push(`  new      ${id} to ${now}`); continue; }
    if (now < was) lines.push(`  OLDER    ${id.padEnd(13)} file had ${was}, these files end ${now}`);
    else if (now !== was) lines.push(`  latest   ${id.padEnd(13)} ${was} → ${now}`);
    // revisions: months both files have, where the value moved
    const a = before.series[id] || [], b = after.series[id];
    const rev = [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] != null && b[i] != null && a[i] !== b[i]) rev.push(i);
    const lost = a.filter((v, i) => v != null && b[i] == null).length;
    if (rev.length) lines.push(`  revised  ${id.padEnd(13)} ${rev.length} month${rev.length > 1 ? 's' : ''}${rev.length <= 3 ? ` (${rev.map(label).join(', ')})` : `, latest ${label(rev.at(-1))}`}`);
    if (lost) lines.push(`  DROPPED  ${id.padEnd(13)} ${lost} months the file had are missing from these files`);
  }
}
const strip = (d) => (d ? JSON.stringify({ ...d, built: '' }) : '');
const changed = strip(before) !== strip(after);
if (changed) {
  await writeFile(out, JSON.stringify(after));
  for (const l of lines) console.log(l);
  console.log(`${after.months} months × ${Object.keys(after.series).length} series from ${after.start}, newest point ${F.newest(after)}. Wrote public/mocks/data/fred-macro.json`);
} else {
  console.log(`No changes: the file already has these ${ids.length} series to ${F.newest(after)}.`);
}
console.log(`changed=${changed}`);
