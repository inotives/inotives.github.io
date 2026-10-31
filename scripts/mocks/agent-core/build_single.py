"""Bundle both Agent Core mock views and their mock API data into one HTML file."""
import base64
import json
import re
import sys
import urllib.parse
from pathlib import Path

mock, data_path, out_path = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])

# key responses by decoded pathname so the shim can match whatever encoding the client uses
data = {urllib.parse.unquote(k): v for k, v in json.loads(data_path.read_text()).items()}

# Answers /api/mock/* from the parent page's embedded data; everything else goes to the network.
SHIM = """<script>
(() => {
  const data = parent.__AGENT_CORE_MOCK__;
  const realFetch = window.fetch.bind(window);
  const json = (body, status) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    let path;
    try {
      path = decodeURIComponent(new URL(url, 'http://mock.local').pathname).replace(/\\/$/, '');
    } catch {
      return realFetch(input, init);
    }
    if (!path.startsWith('/api/mock')) return realFetch(input, init);
    return Promise.resolve(path in data ? json(data[path], 200) : json({ error: 'not found' }, 404));
  };
})();
</script>"""


def with_shim(html):
    html = re.sub(r'\s*<link rel="icon"[^>]*>', '', html)
    return html.replace('<head>', '<head>\n' + SHIM, 1)


# View 1: the DaisyUI galaxy dashboard, with its stylesheet and bundle inlined
galaxy = (mock / 'public/index-alt.html').read_text()
styles = (mock / 'public/styles.css').read_text()
bundle = re.sub(r'\n//# sourceMappingURL=.*$', '', (mock / 'dist/main.js').read_text().rstrip())
assert '</script' not in bundle and '</style' not in styles
galaxy = galaxy.replace('<link rel="stylesheet" href="/styles.css" />', f'<style>\n{styles}\n</style>')
galaxy = galaxy.replace('<script type="module" src="/assets/main.js"></script>', f'<script type="module">\n{bundle}\n</script>')
assert '/styles.css' not in galaxy and '/assets/main.js' not in galaxy

# View 2: the shadcn/ui second-brain page, already self-contained apart from its data
brain = (mock / 'public/index.html').read_text()

views = {'galaxy': with_shim(galaxy), 'brain': with_shim(brain)}
favicon = base64.b64encode((mock / 'public/favicon.svg').read_bytes()).decode()


def script_json(value):
    # safe inside <script>: no "</script>" or "<!--" can appear
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')


page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<title>Agent Core mock</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,{favicon}" />
<style>
  html, body {{ height: 100%; margin: 0; background: #05070d; }}
  #view {{ display: block; width: 100%; height: 100%; border: 0; }}
  .mock-switch {{
    position: fixed; left: 50%; bottom: 14px; z-index: 10; transform: translateX(-50%);
    display: flex; gap: 2px; padding: 3px; border: 1px solid rgb(148 163 184 / 0.25); border-radius: 8px;
    background: rgb(5 7 13 / 0.72); backdrop-filter: blur(8px);
    font: 500 12px/1 ui-sans-serif, system-ui, sans-serif;
  }}
  .mock-switch a, .mock-switch button {{
    border: 0; border-radius: 5px; padding: 7px 10px; background: transparent;
    color: rgb(203 213 225); font: inherit; text-decoration: none; cursor: pointer; white-space: nowrap;
  }}
  /* each view keeps its own controls at the bottom or top centre, so the switcher takes the free edge */
  .mock-switch[data-edge='top'] {{ top: 14px; bottom: auto; }}
  .mock-switch a:hover, .mock-switch button:hover {{ color: #fff; }}
  .mock-switch button[aria-pressed='true'] {{ background: rgb(148 163 184 / 0.2); color: #fff; }}
  .mock-switch a {{ border-right: 1px solid rgb(148 163 184 / 0.25); border-radius: 0; margin-right: 2px; }}
  :focus-visible {{ outline: 2px solid #22d3ee; outline-offset: 2px; }}
</style>
</head>
<body>
<iframe id="view" title="Agent Core mock view"></iframe>
<nav class="mock-switch" aria-label="Mock view">
  <a href="/playground">Playground</a>
  <button type="button" data-view="galaxy">Galaxy dashboard (DaisyUI)</button>
  <button type="button" data-view="brain">Second brain (shadcn/ui)</button>
</nav>
<script>
window.__AGENT_CORE_MOCK__ = {script_json(data)};
const VIEWS = {script_json(views)};
const frame = document.getElementById('view');
const nav = document.querySelector('.mock-switch');
const buttons = nav.querySelectorAll('button');
const EDGE = {{ galaxy: 'bottom', brain: 'top' }};

function show(name) {{
  if (!(name in VIEWS)) name = 'galaxy';
  frame.srcdoc = VIEWS[name];
  nav.dataset.edge = EDGE[name];
  buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  const url = new URL(location.href);
  url.searchParams.set('view', name);
  history.replaceState(null, '', url);
}}

buttons.forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
show(new URLSearchParams(location.search).get('view'));
</script>
</body>
</html>
"""

out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(page)
print(f'wrote {out_path} ({out_path.stat().st_size // 1024} KB)')
