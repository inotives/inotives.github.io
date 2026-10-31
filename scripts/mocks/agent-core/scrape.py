"""Capture every mock API response (by pathname) into one JSON map."""
import json, sys, urllib.request, urllib.parse
base = 'http://127.0.0.1:1199'
get = lambda p: json.load(urllib.request.urlopen(base + p))
out = {'/api/mock': get('/api/mock')}
for ep in out['/api/mock']['endpoints']:
    out[ep['path']] = get(ep['path'])
for node in out['/api/mock/memory']['nodes']:
    path = '/api/mock/notes/' + '/'.join(urllib.parse.quote(s, safe='') for s in node['id'].split('/'))
    out[path] = get(path)
json.dump(out, open(sys.argv[1], 'w'), separators=(',', ':'), ensure_ascii=False)
print(len(out), 'responses')
