// Signs in as a demo kid on the local Sparkling API and saves what the island page shows.
import { writeFileSync } from 'node:fs';

const [, , out, username = 'mia', pin = '1234'] = process.argv;
const BASE = 'http://127.0.0.1:8790/api';
let cookie = '';

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  if (res.status !== 200) throw new Error(`${method} ${path}: ${res.status}`);
  return res.json();
}

await call('POST', '/auth/login/kid', { username, pin });
const data = {
  me: await call('GET', '/auth/me'),
  play: await call('GET', '/play/state'),
  today: await call('GET', '/play/daily-tasks'),
  fonts: await call('GET', '/fonts'),
};
writeFileSync(out, JSON.stringify(data));
