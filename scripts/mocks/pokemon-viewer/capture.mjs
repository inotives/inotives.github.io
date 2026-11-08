// Captures the bundled index for the Pokémon specimen lab mock (public/mocks/pokemon-viewer.html).
//
//   npm run pokemon        (or: node scripts/mocks/pokemon-viewer/capture.mjs)
//
// The loaders live in the mock itself, between the `// <poke-data>` markers, so the page's "Sync"
// button and this snapshot share one data shape. This script imports that block, runs the index
// loader (9 generation + 18 type requests to PokeAPI, no key needed) and writes
// public/mocks/data/pokemon-viewer.json. Specimen sheets are not bundled: the page loads them live.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const page = new URL('public/mocks/pokemon-viewer.html', root);
const out = new URL('public/mocks/data/pokemon-viewer.json', root);

const html = await readFile(page, 'utf8');
const block = html.match(/\/\/ <poke-data>([\s\S]*?)\/\/ <\/poke-data>/);
if (!block) throw new Error('poke-data block not found in pokemon-viewer.html');
const src = `${block[1]}\nexport default POKE_DATA;\n`;
const { default: D } = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);

const t0 = Date.now();
let n = 0;
const idx = await D.loadIndex(() => { n++; process.stdout.write(`\rrequests ${n}/27`); });
process.stdout.write('\n');
const json = JSON.stringify(idx);
await writeFile(out, json);
console.log(`${idx.pokemon.length} Pokémon, ${idx.gens.length} generations, ${Object.keys(idx.moveTypes).length} moves`);
console.log(`wrote ${out.pathname.replace(root.pathname, '')} (${(json.length / 1024).toFixed(0)} KB) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
