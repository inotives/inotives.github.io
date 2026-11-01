// Captures the snapshot for the Block explorer 3D mock (public/mocks/block-explorer.html).
//
//   node scripts/mocks/block-explorer/capture.mjs
//
// The loaders live in the mock itself, between the `// <chain-data>` markers, so the page's
// "Go live" sync and this snapshot always share one data shape. This script imports that block,
// runs the overview loaders for Bitcoin, Ethereum and Solana, keeps every transaction for the
// newest few blocks of each chain, and writes public/mocks/data/block-explorer.json.
// Sources: mempool.space (Bitcoin), publicnode Ethereum and Solana RPC. No API keys needed.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const page = new URL('public/mocks/block-explorer.html', root);
const out = new URL('public/mocks/data/block-explorer.json', root);
const BLOCKS_WITH_TXS = 3;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const html = await readFile(page, 'utf8');
const block = html.match(/\/\/ <chain-data>([\s\S]*?)\/\/ <\/chain-data>/);
if (!block) throw new Error('chain-data block not found in block-explorer.html');
const src = `${block[1]}\nexport default CHAIN_DATA;\n`;
const { default: D } = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);

const step = async (name, fn) => {
  const t0 = Date.now();
  const v = await fn();
  console.log(`${name.padEnd(28)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return v;
};

// Bitcoin: overview, every tx of the newest blocks, and full details for a sample of them
const btc = { overview: await step('btc overview', D.loadBtcOverview), blocks: {}, txs: {} };
for (const b of [...btc.overview.blocks].sort((a, c) => c.height - a.height).slice(0, BLOCKS_WITH_TXS)) {
  const txs = await step(`btc block ${b.height}`, () => D.loadBtcBlockTxs(b.id));
  btc.blocks[b.id] = txs;
  const rest = txs.slice(1), rate = (t) => (t[2] ? t[1] / t[2] : 0);
  const sample = new Set([
    txs[0][0],                                                            // coinbase
    ...rest.slice(0, 3).map((t) => t[0]),                                 // first in block
    ...[...rest].sort((a, c) => rate(c) - rate(a)).slice(0, 5).map((t) => t[0]),   // highest fee rate
    ...[...rest].sort((a, c) => c[3] - a[3]).slice(0, 5).map((t) => t[0]),         // largest value
  ]);
  await step(`btc ${sample.size} tx details`, async () => {
    for (const id of sample) { btc.txs[id] = await D.loadBtcTx(id); await pause(120); }
  });
}

// Ethereum: overview and the newest blocks with receipts
const eth = { overview: await step('eth overview', () => D.loadEthOverview()), blocks: {}, txs: {} };
for (const b of [...eth.overview.blocks].sort((a, c) => c.number - a.number).slice(0, BLOCKS_WITH_TXS)) {
  eth.blocks[b.number] = await step(`eth block ${b.number}`, () => D.loadEthBlock(b.number));
}

// Solana: slot window with leaders, and the newest produced blocks in full
const sol = { overview: await step('sol overview', () => D.loadSolOverview()), blocks: {}, txs: {} };
for (const s of sol.overview.slots.filter((x) => x.produced).slice(-BLOCKS_WITH_TXS)) {
  sol.blocks[s.slot] = await step(`sol slot ${s.slot}`, () => D.loadSolBlock(s.slot));
  await pause(200);
}

const snapshot = { capturedAt: Date.now(), sources: D.API, btc, eth, sol };
const json = JSON.stringify(snapshot);
await writeFile(out, json);
const kb = (o) => `${Math.round(JSON.stringify(o).length / 1024)} KB`;
console.log(`\nwrote ${out.pathname.split('/public/')[1]}: ${kb(snapshot)} (btc ${kb(btc)}, eth ${kb(eth)}, sol ${kb(sol)})`);
