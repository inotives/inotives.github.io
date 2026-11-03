// Updates the bundled data for the ToTo stats mock (public/mocks/sg-toto.html) from a results CSV.
//
//   npm run toto -- path/to/ToTo.csv
//   node scripts/mocks/sg-toto/build.mjs path/to/ToTo.csv
//
// With no path it looks for ~/Downloads/ToTo.csv. The CSV is the historical results export (one
// row per draw: date, six winning numbers, the additional number and, from mid-2011, winners and
// prize per group). Only 6/49 draws are kept (from draw 2995, October 2014). The parser lives in the mock itself, between the `// <toto-csv>` markers, so
// this script and the page's "Update data" import read a CSV the same way.
//
// Writes public/mocks/data/sg-toto.json, oldest draw first, and reports what changed against the
// previous file: new draws, prize figures filled in, and any past draw whose numbers differ.
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = new URL('../../../', import.meta.url);
const page = new URL('public/mocks/sg-toto.html', root);
const out = new URL('public/mocks/data/sg-toto.json', root);
const csvPath = process.argv[2] || join(homedir(), 'Downloads', 'ToTo.csv');

const html = await readFile(page, 'utf8');
const block = html.match(/\/\/ <toto-csv>([\s\S]*?)\/\/ <\/toto-csv>/);
if (!block) throw new Error('toto-csv block not found in sg-toto.html');
const src = `${block[1]}\nexport default { parseToto, toCompact, fromCompact, FIRST_649_DRAW };\n`;
const { default: T } = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);

let text;
try {
  text = await readFile(csvPath, 'utf8');
} catch {
  console.error(`Couldn't read ${csvPath}\nusage: npm run toto -- path/to/ToTo.csv`);
  process.exit(1);
}
const draws = T.parseToto(text);

// compare with the file we are about to replace
let before = [];
try { before = JSON.parse(await readFile(out, 'utf8')).draws.map(T.fromCompact); } catch { /* first build */ }
const old = new Map(before.map((d) => [d.draw, d]));
const added = draws.filter((d) => !old.has(d.draw));
const prized = draws.filter((d) => old.has(d.draw) && d.prizes && !old.get(d.draw).prizes);
const changed = draws.filter((d) => { const o = old.get(d.draw); return o && (o.n.join() !== d.n.join() || o.add !== d.add); });
// 6/45 draws (before draw 2995) are left out on purpose by the parser, so they are not reported missing
const retired = before.filter((d) => d.draw < T.FIRST_649_DRAW);
const dropped = before.filter((d) => d.draw >= T.FIRST_649_DRAW && !draws.some((x) => x.draw === d.draw));

const data = {
  source: 'Singapore Pools ToTo results, historical CSV export',
  built: new Date().toISOString().slice(0, 10),
  draws: draws.map(T.toCompact),
};
await writeFile(out, JSON.stringify(data));

const first = draws[0], last = draws.at(-1);
const fmt = (d) => `${d.draw} (${d.date}): ${d.n.join(' ')} +${d.add}`;
console.log(`${draws.length} draws, ${first.draw} (${first.date}) to ${last.draw} (${last.date}); ${draws.filter((d) => d.prizes).length} with prize figures`);
if (!before.length) console.log('No previous file: wrote a fresh one.');
else if (!added.length && !prized.length && !changed.length && !dropped.length && !retired.length) console.log('No changes from the previous file.');
if (retired.length) console.log(`  left out ${retired.length} 6/45 draws from the previous file (before draw ${T.FIRST_649_DRAW}, October 2014)`);
for (const d of added) console.log(`  new      ${fmt(d)}${d.prizes ? '' : ' (no prize figures yet)'}`);
for (const d of prized) console.log(`  prizes   ${d.draw}: prize figures added`);
for (const d of changed) console.log(`  CHANGED  ${fmt(d)} (was ${old.get(d.draw).n.join(' ')} +${old.get(d.draw).add})`);
if (dropped.length) console.log(`  MISSING  ${dropped.length} draws from the previous file are not in this CSV (${dropped.slice(0, 5).map((d) => d.draw).join(', ')}${dropped.length > 5 ? ', …' : ''})`);
console.log(`Wrote ${out.pathname.replace(root.pathname, '')}`);
