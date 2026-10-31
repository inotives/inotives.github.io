// Builds public/mocks/inoai.html: inoai's own ring console page (src/ui/pages/app-shell.ts)
// with demo data in place of the UI server. Run: node scripts/mocks/inoai/build.mjs [path to inoai]
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const inoai = process.argv[2] ?? join(homedir(), 'workspaces/inoai');
const { renderAppShell } = await import(join(inoai, 'src/ui/pages/app-shell.ts'));

// the token only gates writes, which the demo refuses anyway
let html = renderAppShell('0');
const demo = readFileSync(join(here, 'demo-data.js'), 'utf8');
if (demo.includes('</script')) throw new Error('demo-data.js must not contain </script');

const script = '<script type="module">';
if (html.split(script).length !== 2) throw new Error('expected one module script in the page');
html = html
  .replace('<title>inoai</title>', '<title>inoai console mock</title>')
  .replace(script, `<script>\n${demo}</script>\n${script}`);

const out = join(here, '../../../public/mocks/inoai.html');
writeFileSync(out, html);
console.log(`wrote ${out} (${Math.round(html.length / 1024)} KB)`);
