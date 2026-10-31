"""Bundle the Spark Island mock (the island-only build and its demo data) into one HTML file."""
import base64
import json
import os
import re
import sys
from pathlib import Path

dist, data_path, out_path = (Path(p) for p in sys.argv[1:4])
raw = json.loads(data_path.read_text())

# keep only what the island draws: the Sparklings on it, its decorations, needs, levels and today's tasks
state = raw['play']['state']
shown = {state['activeId'], *state['room']['guests']}
state['sparklings'] = {k: v for k, v in state['sparklings'].items() if k in shown}
state['inventory'] = {}
state['accessories'] = []
state['room']['song'] = None
# a well-fed Sparkling, not one lying down hungry
state['fullness'], state['joy'] = 64, 82

catalog = raw['play']['catalog']
placed = set(state['room']['spots'].values())
worn = {a for s in state['sparklings'].values() for a in s['equipped'].values()}
catalog['items'] = [i for i in catalog['items'] if i['id'] in placed]
catalog['accessories'] = [a for a in catalog['accessories'] if a['id'] in worn]
for key in ('missions', 'practice', 'writing', 'coach', 'exams'):
    catalog[key] = []

data = {
    'kid': {'id': 'demo', 'displayName': raw['me']['kid']['displayName'], 'username': 'demo'},
    'play': {'state': state, 'catalog': catalog},
    'today': raw['today'],
    'fonts': raw['fonts'],
}
# test kids and any names from MOCK_PRIVATE_TERMS ("name|other", kept out of this repo) must not ship
private = '|'.join(filter(None, ['smoke', os.environ.get('MOCK_PRIVATE_TERMS', '')]))
assert not re.search(rf'\b({private})\b', json.dumps(data), re.I), 'private or test names in the mock data'

html = (dist / 'index.html').read_text()
js_file = re.search(r'src="\./(assets/[^"]+\.js)"', html).group(1)
css_file = re.search(r'href="\./(assets/[^"]+\.css)"', html).group(1)
css = (dist / css_file).read_text()
assert '</style' not in css
js = base64.b64encode((dist / js_file).read_bytes()).decode()


def script_json(value):
    # safe inside <script>: no "</script>" or "<!--" can appear
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')


html = re.sub(r'\s*<script type="module"[^>]*></script>', '', html)
html = re.sub(r'\s*<link rel="stylesheet" crossorigin[^>]*>', '', html)
html = html.replace('<title>Sparkling</title>', '<title>Spark Island mock</title>')
head = f"""<style>
{css}
</style>
<script>window.__SPARK_DATA__ = {script_json(data)};</script>
"""
html = html.replace('</head>', head + '  </head>', 1)
# the app is loaded from a data: URL so nothing in its source can end the <script> early
html = html.replace('</body>', f'<script type="module">import("data:text/javascript;base64,{js}");</script>\n  </body>', 1)

out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text(html)
print(f'wrote {out_path} ({out_path.stat().st_size // 1024} KB)')
