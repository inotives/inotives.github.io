// Captures the bundled snapshot for the Next open signals mock (public/mocks/stock-signals.html).
//
//   npm run stocks                     capture the default symbols
//   npm run stocks -- NVDA AMD ^GSPC   capture these instead
//
// Fetches the last 60 completed daily sessions per symbol from the Yahoo Finance chart API (no
// key needed server side; browsers are blocked by CORS, which is why the page needs a snapshot).
// The parser lives in the mock itself, between the `// <yahoo-data>` markers, so this snapshot
// and the page's "Sync data" share one data shape. Writes public/mocks/data/stock-signals.json.
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const page = new URL('public/mocks/stock-signals.html', root);
const out = new URL('public/mocks/data/stock-signals.json', root);
const DEFAULT = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'SPY'];
const symbols = process.argv.slice(2).map((s) => s.toUpperCase());

const html = await readFile(page, 'utf8');
const block = html.match(/\/\/ <yahoo-data>\n([\s\S]*?)\/\/ <\/yahoo-data>/);
if (!block) throw new Error('yahoo-data block not found in stock-signals.html');
const src = `${block[1]}\nexport default YAHOO;\n`;
const { default: YAHOO } = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);

const snapshot = { capturedAt: new Date().toISOString(), source: 'Yahoo Finance chart API, daily bars', symbols: {} };
let failed = 0;
for (const symbol of symbols.length ? symbols : DEFAULT) {
  try {
    const res = await fetch(YAHOO.host + YAHOO.path(symbol), { headers: { 'User-Agent': 'Mozilla/5.0 (inotives mock capture)' } });
    const json = await res.json();
    const data = YAHOO.parse(json);
    snapshot.symbols[data.symbol] = data;
    console.log(`${data.symbol.padEnd(6)} ${data.bars.length} sessions  ${data.bars[0][0]} → ${data.bars.at(-1)[0]}${data.inSession ? '  (session in progress, left out)' : ''}`);
  } catch (e) {
    failed++;
    console.error(`${symbol.padEnd(6)} failed: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
if (!Object.keys(snapshot.symbols).length) { console.error('Nothing captured'); process.exit(1); }
await writeFile(out, `${JSON.stringify(snapshot)}\n`);
console.log(`Wrote ${new URL(out).pathname.replace(new URL(root).pathname, '')}`);
if (failed) process.exitCode = 1;
