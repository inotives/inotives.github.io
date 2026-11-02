// Keeps the playground layout standard in step across mocks.
//
//   node scripts/mocks/template/check.mjs           report mocks whose standard blocks differ
//   node scripts/mocks/template/check.mjs --write   copy the template's blocks into those mocks
//
// The standard lives in scripts/mocks/template/playground.html between two pairs of markers:
// the CSS block `/* <pg-layout vN> ... </pg-layout> */` and the script block
// `/* <pg-layout-js vN> ... </pg-layout-js> */`. Every public/mocks/*.html that has the markers
// must carry the same text. Mocks without the markers are listed but left alone.
import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const template = await readFile(new URL('scripts/mocks/template/playground.html', root), 'utf8');
const BLOCKS = [
  { name: 'CSS', re: /\/\* <pg-layout v\d+>[\s\S]*?\/\* <\/pg-layout> \*\// },
  { name: 'script', re: /\/\* <pg-layout-js v\d+>[\s\S]*?\/\* <\/pg-layout-js> \*\// },
];
const wanted = BLOCKS.map((b) => {
  const m = template.match(b.re);
  if (!m) throw new Error(`template is missing the ${b.name} block`);
  return m[0];
});

const write = process.argv.includes('--write');
const dir = new URL('public/mocks/', root);
const files = (await readdir(dir)).filter((f) => f.endsWith('.html')).sort();
let drift = 0;
for (const f of files) {
  const url = new URL(f, dir);
  let html = await readFile(url, 'utf8');
  const found = BLOCKS.map((b) => html.match(b.re)?.[0] ?? null);
  if (found.every((x) => x === null)) { console.log(`-  ${f}  (no standard blocks)`); continue; }
  const bad = BLOCKS.filter((b, i) => found[i] !== wanted[i]).map((b, i) => (found[BLOCKS.indexOf(b)] === null ? `${b.name} missing` : `${b.name} differs`));
  if (!bad.length) { console.log(`ok ${f}`); continue; }
  drift++;
  if (write && !found.includes(null)) {
    BLOCKS.forEach((b, i) => { html = html.replace(b.re, () => wanted[i]); });
    await writeFile(url, html);
    console.log(`✎  ${f}  (updated: ${bad.join(', ')})`);
  } else {
    console.log(`✗  ${f}  (${bad.join(', ')})`);
  }
}
if (drift && !write) { console.log('\nRun with --write to copy the template blocks into these mocks.'); process.exitCode = 1; }
