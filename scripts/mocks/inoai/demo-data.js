// Demo data for the inoai UI mock, and a fetch stand-in that serves it as /api/ui-data.
// Times are worked out when the page loads, so "last 24 hours" always has something in it.
// Task changes are refused: this is a mockup.
(() => {
  const now = Date.now();
  const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  const iso = (ms) => new Date(ms).toISOString();
  const ago = (ms) => iso(now - ms);
  // a fixed sequence, so the charts look the same on every load
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const int = (lo, hi) => Math.floor(lo + rand() * (hi - lo + 1));
  // Schedule times are Singapore time (UTC+8). `days` are 0 (Sun) to 6 (Sat); empty means every day.
  const SGT = 8 * HOUR;
  function occurrences(time, days = []) {
    const [hh, mm] = time.split(':').map(Number);
    const local = new Date(now + SGT);
    const today = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + (hh * 60 + mm) * MIN - SGT;
    const fits = (t) => !days.length || days.includes(new Date(t + SGT).getUTCDay());
    const past = [], next = [];
    for (let i = -14; i <= 14; i++) {
      const t = today + i * DAY;
      if (fits(t)) (t <= now ? past : next).push(t);
    }
    return { last: past.reverse(), next: next[0] };
  }
  const brief = occurrences('07:30'), review = occurrences('18:00', [5]), digest = occurrences('20:00', [1, 3]);

  // ---- conversations ----
  const chats = [
    ['What’s on my calendar tomorrow?', 'Two things: a 10:00 design review and a 15:30 dentist appointment. Want a reminder an hour before each?'],
    ['Yes please, remind me before both.', 'Done. I’ll message you at 09:00 and 14:30 tomorrow.'],
    ['Summarise the three most-read posts on Hacker News today.', 'Here are today’s top three: a deep dive on SQLite internals, a post on running LLMs on a laptop, and a history of the Unix pipe. Short notes on each are below.'],
    ['Draft a short reply thanking Sam for the review notes.', 'Draft: “Thanks Sam, these notes are really helpful. I’ll fold them in before Friday.” Send it as is, or change anything?'],
    ['How much did I spend on coffee this month?', 'From the receipts you forwarded: 14 coffees, $61.20 in total, about $4.37 each.'],
    ['Turn the weekly review into a checklist.', 'Weekly review checklist:\n- Clear the inbox\n- Review last week’s notes\n- Plan the top three goals\n- Check upcoming deadlines'],
    ['What did we decide about the trip in March?', 'You chose Kyoto for 5 nights from 12 March, with a day trip to Nara. Flights aren’t booked yet.'],
    ['Find a 30-minute slot for a call with Priya this week.', 'Thursday 14:00 and Friday 11:30 are free for both of you. Which one should I offer?'],
    ['Translate “see you next week” into Japanese.', '“また来週” (mata raishū).'],
    ['Check the build status of the side project.', 'The latest build passed 12 minutes ago. All 248 tests are green.'],
  ];
  const messages = [];
  let id = 4120;
  chats.forEach(([ask, answer], i) => {
    const at = now - (i * 2.6 + 0.4) * HOUR;
    const failed = i === 3 || i === 7;
    messages.push({ id: ++id, workspaceId: 'home', transport: 'discord', direction: 'owner', state: 'completed', body: ask, createdAt: iso(at), updatedAt: iso(at) });
    messages.push({
      id: ++id, workspaceId: 'home', transport: 'discord', direction: 'agent', state: failed ? 'failed' : 'completed',
      body: failed ? 'The model provider timed out before replying. I’ll try again when you ask.' : answer,
      createdAt: iso(at + 40_000), updatedAt: iso(at + 52_000),
    });
  });
  messages.push({ id: ++id, workspaceId: 'home', transport: 'discord', direction: 'owner', state: 'completed', body: 'Plan my Saturday around the farmers market.', createdAt: ago(3 * MIN), updatedAt: ago(3 * MIN) });
  messages.push({ id: ++id, workspaceId: 'home', transport: 'discord', direction: 'agent', state: 'processing', body: 'Working on it…', createdAt: ago(2 * MIN), updatedAt: ago(1 * MIN) });
  messages.reverse();

  // ---- tasks ----
  const task = (t) => ({
    title: null, outputSpec: null, timezone: 'Asia/Singapore', scheduleKind: null, scheduleTime: null, scheduleDays: null,
    endsAt: '', maxRuns: null, intervalSeconds: null, redactedFields: [], updatedAt: ago(2 * DAY), ...t,
  });
  const tasks = [
    task({ id: 31, title: 'Morning brief', goal: 'Summarise today’s calendar, the weather and anything urgent in the inbox.', outputSpec: 'A short list, most urgent first.',
      taskType: 'recurring', state: 'active', scheduleKind: 'daily', scheduleTime: '07:30', scheduleLabel: 'Daily at 07:30', nextDueAt: iso(brief.next), createdAt: ago(40 * DAY),
      runs: { completed: 38, failed: 1, lastState: 'completed', lastAt: iso(brief.last[0]) } }),
    task({ id: 32, title: 'Weekly review', goal: 'Collect the week’s notes, finished tasks and open loops into one review.', outputSpec: 'Wins, open loops, and three goals for next week.',
      taskType: 'recurring', state: 'active', scheduleKind: 'weekly', scheduleTime: '18:00', scheduleDays: 'fri', scheduleLabel: 'Weekly on Friday at 18:00', nextDueAt: iso(review.next), createdAt: ago(60 * DAY),
      runs: { completed: 8, failed: 0, lastState: 'completed', lastAt: iso(review.last[0]) } }),
    task({ id: 33, title: 'Reading list digest', goal: 'Pick the three best unread articles from the reading list and summarise each in two lines.',
      taskType: 'recurring', state: 'active', scheduleKind: 'days', scheduleTime: '20:00', scheduleDays: 'mon,wed', scheduleLabel: 'Mon and Wed at 20:00', nextDueAt: iso(digest.next), createdAt: ago(21 * DAY),
      runs: { completed: 6, failed: 1, lastState: 'failed', lastAt: iso(digest.last[0]) } }),
    task({ id: 34, title: 'Server disk check', goal: 'Check free disk space on the home server and warn below 15%.',
      taskType: 'recurring', state: 'paused', intervalSeconds: 6 * 3600, scheduleKind: 'interval', scheduleLabel: 'Every 6 hours', nextDueAt: '', createdAt: ago(30 * DAY),
      runs: { completed: 52, failed: 0, lastState: 'completed', lastAt: ago(3 * DAY) } }),
    task({ id: 35, title: 'Book the Kyoto ryokan', goal: 'Remind me to book the ryokan for the March trip.',
      taskType: 'one_time', state: 'completed', scheduleKind: 'once', scheduleLabel: 'Once', nextDueAt: '', createdAt: ago(9 * DAY),
      runs: { completed: 1, failed: 0, lastState: 'completed', lastAt: ago(7 * DAY) } }),
  ];
  const taskRuns = [
    { id: 902, taskId: 31, state: 'completed', startedAt: iso(brief.last[0]), completedAt: iso(brief.last[0] + 50_000), failureDetail: null, resultNote: null,
      result: '# Morning brief\n\n## Calendar\n\n- 10:00 Design review\n- 15:30 Dentist\n\n## Weather\n\n31°C, showers after 16:00. Take an umbrella.\n\n## Inbox\n\nOne invoice due Friday; nothing else urgent.' },
    { id: 871, taskId: 31, state: 'completed', startedAt: iso(brief.last[1]), completedAt: iso(brief.last[1] + 45_000), failureDetail: null, resultNote: null,
      result: '# Morning brief\n\n## Calendar\n\nClear until 14:00.\n\n## Weather\n\n30°C, dry.\n\n## Inbox\n\nNothing urgent.' },
    { id: 860, taskId: 32, state: 'completed', startedAt: iso(review.last[0]), completedAt: iso(review.last[0] + 120_000), failureDetail: null, resultNote: null,
      result: '# Weekly review\n\n## Wins\n\n- Shipped the reading list digest\n- Three workouts\n\n## Open loops\n\n- Flights for March\n\n## Next week\n\n1. Book flights\n2. Finish the draft post\n3. Clear the photo backlog' },
    { id: 851, taskId: 33, state: 'failed', startedAt: iso(digest.last[0]), completedAt: iso(digest.last[0] + 30_000), failureDetail: 'The reading list feed returned 503.', result: null, resultNote: 'No result: the run failed.' },
    { id: 812, taskId: 34, state: 'completed', startedAt: ago(3 * DAY), completedAt: ago(3 * DAY - 8_000), failureDetail: null, resultNote: null, result: 'Disk: 41% free on /, 63% free on /data. All good.' },
    { id: 640, taskId: 35, state: 'completed', startedAt: ago(7 * DAY), completedAt: ago(7 * DAY - 5_000), failureDetail: null, resultNote: null, result: 'Reminder sent: book the ryokan for 12–17 March.' },
  ];

  // ---- memory ----
  const memory = [
    ['Prefers short answers with a list when there are several items.', 'completed', 'Kept: a stable preference about answer style.'],
    ['Usually works 09:00–18:00 Singapore time; no reminders after 22:00.', 'completed', 'Kept and linked to the reminder rules.'],
    ['Trip to Kyoto 12–17 March, with a day trip to Nara.', 'completed', 'Kept until the trip ends.'],
    ['Likes oat flat whites; avoids sugar in coffee.', 'completed', null],
    ['The side project’s builds run on GitHub Actions.', 'processing', null],
    ['Is reading “A Philosophy of Software Design”.', null, null],
    ['Wants the weekly review on Friday evenings, not Sunday.', 'completed', 'Merged with the earlier review schedule note.'],
    ['Dentist appointments are at the clinic near the office.', null, null],
  ];
  const memories = memory.map(([body, review, recap], i) => ({
    id: 210 + i, origin: i % 3 === 0 ? 'conversation' : i % 3 === 1 ? 'task' : 'review', state: 'active', body,
    review: review ? { id: 70 + i, state: review, recap } : null, createdAt: ago((i * 3 + 1) * DAY / 2), updatedAt: ago((i * 3) * DAY / 2),
  }));

  // ---- skills ----
  const skill = (id, version, description, body, extra = []) => ({
    id, version, approvedAt: ago(20 * DAY), capabilities: { network: true, files: 'read' },
    files: [{ path: 'SKILL.md', size: 600, text: `---\nname: ${id}\ndescription: ${description}\n---\n\n# ${id}\n\n${body}` }, ...extra],
  });
  const skillDetails = [
    skill('calendar', '1.2.0', 'Read and summarise calendar events; draft invites.', 'Reads the calendar feed and answers questions about upcoming events.'),
    skill('web-search', '0.9.1', 'Search the web and summarise the top results with links.', 'Runs a search, opens the best results and writes a short summary with sources.'),
    skill('reading-list', '0.4.0', 'Keep a reading list and pick what to read next.', 'Stores links with a note and suggests the next read.', [{ path: 'scripts/feed.mjs', size: 1840, text: '// Reads the reading list feed and returns unread items.\nexport async function unread(feedUrl) {\n  const res = await fetch(feedUrl);\n  return (await res.json()).filter((item) => !item.read);\n}\n' }]),
    skill('server-health', '1.0.3', 'Check disk, memory and uptime on the home server.', 'Connects to the home server over SSH and reports disk, memory and uptime.'),
  ];

  // ---- health: hourly heartbeats, one degraded hour and a restart ----
  const health = [];
  for (let i = 0; i < 24; i++) {
    const at = now - i * HOUR - 5 * MIN;
    let detail = { status: 'healthy', latency_ms: int(180, 420) };
    if (i === 6) detail = { status: 'degraded', latency_ms: 4200, reason: 'provider_slow' };
    if (i === 15) detail = { status: 'degraded', action: 'restart', reason: 'transport_disconnected' };
    health.push({ eventType: 'heartbeat', detail: JSON.stringify(detail), createdAt: iso(at) });
  }
  health.push({ eventType: 'heartbeat_recovery', detail: JSON.stringify({ status: 'healthy', after: 'restart' }), createdAt: ago(14 * HOUR + 50 * MIN) });

  // ---- insights ----
  function insight(bucket, count) {
    const step = bucket === 'hour' ? HOUR : DAY;
    const end = Math.floor(now / step) * step;
    const scale = bucket === 'hour' ? 1 : 14;
    const starts = Array.from({ length: count }, (_, i) => iso(end - (count - 1 - i) * step));
    const volume = starts.map((start) => { const owner = int(0, 4) * scale; return { start, owner, agent: owner + int(0, 1) * scale }; });
    const series = starts.map((start) => ({ start, input: int(2, 9) * 1000 * scale, output: int(1, 4) * 600 * scale, cached: int(4, 14) * 1000 * scale, reasoning: int(0, 2) * 300 * scale }));
    const sum = (k) => series.reduce((n, r) => n + r[k], 0);
    const turns = volume.reduce((n, v) => n + v.agent, 0);
    return {
      bucket,
      conversationTypes: { chat: turns, oneTime: Math.round(count / 6), recurring: Math.round(count / 2) },
      volume,
      replyTime: { count: turns, medianSeconds: 11.4, p90Seconds: 38.2 },
      failures: [{ cause: 'turn_failed:provider_timeout', count: Math.max(1, Math.round(count / 12)) }, { cause: 'runtime_failure:transport_disconnected', count: 1 }],
      taskRuns: { completed: Math.round(count / 2) + 2, failed: 1 },
      tokens: { series, totals: { input: sum('input'), output: sum('output'), cached: sum('cached'), reasoning: sum('reasoning'), costUsd: sum('input') * 3e-6 + sum('output') * 15e-6, turns } },
      skills: [{ skill: 'calendar', count: Math.round(count / 2) + 3 }, { skill: 'web-search', count: Math.round(count / 3) + 2 }, { skill: 'reading-list', count: Math.round(count / 6) + 1 }, { skill: 'server-health', count: Math.round(count / 4) }],
    };
  }

  const recent = messages.filter((m) => now - Date.parse(m.createdAt) <= DAY);
  const data = {
    profile: { agentInstanceId: 'inoai-connect-atlas', provider: 'anthropic', transport: 'discord', workspaceIds: ['home'], status: 'running' },
    metrics: {
      messages24h: recent.length, messages30d: 486,
      failedReplies24h: recent.filter((m) => m.direction === 'agent' && m.state === 'failed').length, failedReplies30d: 9,
      activeSessions: 3, messagesPerSession: Math.round(recent.length / 3),
    },
    agentMarkdown: '# Atlas\n\nA personal assistant for one owner, reached over Discord.\n\n## How I work\n\n- Answer briefly; use a list when there are several items.\n- Ask before sending anything on the owner’s behalf.\n- No reminders after 22:00 Singapore time.\n\n## What I look after\n\n- Calendar and reminders\n- A reading list\n- The home server’s health',
    skills: skillDetails.map((s) => s.id),
    skillDetails,
    tasks,
    taskRuns,
    tools: ['send_message', 'read_file', 'web_fetch', 'schedule_task', 'remember'],
    health,
    messages,
    memories,
    insights: { '24h': insight('hour', 24), '7d': insight('day', 7), '30d': insight('day', 30) },
  };

  const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const path = new URL(typeof input === 'string' ? input : input.url, location.href).pathname;
    if (path === '/api/ui-data') return json(data);
    if (path.startsWith('/api/')) return json({ error: 'This is a demo on mock data, so changes aren’t saved.' }, 403);
    return realFetch(input, init);
  };
})();
