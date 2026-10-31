// Spark Island mock: replaces the app's main.ts. Draws one kid's island from embedded demo data
// with the app's own scene and panels, and nothing else: no API, menu, games, shop or profile.
// Turning the island, poking Sparkling and resetting the view work; every other button is for show.
import './styles.css';
import type { KidInfo, PlayData } from '@sparkling/shared/api';
import type { DailyTasks } from '@sparkling/shared/dailyTasks';
import { activeSparkling, totalLevel } from '@sparkling/shared/progression';
import { yearLabel } from '@sparkling/shared/curriculum';
import { variantById } from '@sparkling/shared/variants';
import { SUBJECTS, catalog, outfitOf, setCatalog } from './game/catalog';
import { SparklingScene } from './scene/SparklingScene';
import { $, esc } from './ui/html';
import { icon } from './ui/icons';
import { goldFraction, goldResting, ringFraction } from './ui/rings';
import { renderRoomOverlay, roomView } from './ui/room';
import { refreshToday } from './ui/today';

interface MockData {
  kid: KidInfo;
  play: PlayData;
  today: DailyTasks;
  fonts: unknown;
}

const data = (window as unknown as { __SPARK_DATA__: MockData }).__SPARK_DATA__;

// the panels ask the API for today's tasks and the fonts; answer from the data, nothing else
const answers: Record<string, unknown> = { '/api/play/daily-tasks': data.today, '/api/fonts': data.fonts };
window.fetch = async (input) => {
  const path = new URL(typeof input === 'string' ? input : (input as Request).url, location.href).pathname;
  return new Response(JSON.stringify(answers[path] ?? { error: 'Not in this demo.' }), {
    status: path in answers ? 200 : 404,
    headers: { 'content-type': 'application/json' },
  });
};

const POKED = ['Hehe! That tickles!', 'Boop!', 'Again, again!', 'Wheee!', 'Hi there!', 'Welcome to Spark Island!'];
const s = data.play.state;
setCatalog(data.play.catalog);

// The island page from ui/shell.ts (room layout), without the menu, drawers and dialogs around it.
// Buttons keep their look but have no handlers, apart from Reset view.
const speech = `<p id="speech" data-hidden="true" role="status" aria-live="polite"
  class="speech pointer-events-none absolute inset-x-6 top-4 mx-auto w-fit max-w-xs bg-base-300 px-4 py-2 text-center text-[15px]"></p>`;
const root = $('#app');
root.innerHTML = `
  <span aria-hidden="true"
    class="fixed left-3 top-3 z-20 grid size-9 place-items-center rounded-xl text-base-content/40 ring-1 ring-white/[0.06] backdrop-blur">
    ${icon('menu', 'text-base')}
  </span>
  <div class="fixed left-14 top-3 z-20 flex h-9 items-center gap-2.5 rounded-xl bg-base-100/50 px-3 ring-1 ring-primary/30 backdrop-blur">
    <span class="max-w-28 truncate text-sm text-base-content/75">${esc(data.kid.displayName)}</span>
    <span class="font-label text-lg leading-none text-primary" style="text-shadow:0 0 12px #2ee6ff">Lv ${totalLevel(s)}</span>
    <span class="h-4 w-px bg-white/15" aria-hidden="true"></span>
    <span class="font-label text-sm leading-none" style="color:#b48cff">${yearLabel(Math.min(...Object.values(s.years)))}</span>
  </div>
  <div id="scene" class="fixed inset-0 z-0" aria-hidden="true"></div>
  <main class="relative z-10 mx-auto flex h-dvh w-full max-w-5xl select-none flex-col px-3 pb-3 pt-14 sm:px-4">
    <header id="room-header" class="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 pb-2">
      <h1 class="sr-only">Spark Island</h1>
      <span class="flex-1" aria-hidden="true"></span>
      <span id="room-sparks" class="text-sm"></span>
      <span class="tag" title="Badges earned">${icon('trophy', 'text-[10px]')}<span id="room-badges"></span></span>
      <button id="room-visit" class="btn-quiet min-h-9 px-3 text-sm ring-1 ring-white/[0.08]">${icon('users', 'text-xs')}Visit</button>
      <button id="room-edit-toggle" class="btn-neon min-h-9 px-3 text-sm"></button>
    </header>
    <header id="visit-header" hidden></header>
    <section id="plain" class="relative min-h-0 flex-1 touch-none" aria-label="Spark Island: drag to turn, pinch or scroll to zoom">
      ${speech}
      <span class="absolute bottom-2 left-2 z-10 flex h-9 max-w-[60%] items-center gap-2 rounded-xl px-3 text-sm text-base-content/80 ring-1 ring-white/[0.08] backdrop-blur">
        <span class="eq eq-off" style="color:#ff5cf0" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="truncate">Island Breeze</span>${icon('music', 'text-xs text-base-content/45')}
      </span>
      <button id="reset-view" title="Back to the starting view"
        class="absolute bottom-2 right-2 z-10 flex h-9 items-center gap-2 rounded-xl px-3 text-sm text-base-content/70 ring-1 ring-white/[0.08] backdrop-blur transition-colors hover:bg-white/[0.06] hover:text-base-content">
        ${icon('refresh', 'text-xs')}Reset view
      </button>
    </section>
    <section id="today" class="mx-auto mt-3 w-full max-w-3xl shrink-0" aria-label="Today’s tasks"></section>
    <section id="stats" class="mx-auto mt-3 w-full max-w-3xl shrink-0" aria-label="Stats"></section>
  </main>`;

renderRoomOverlay(s);
void refreshToday();

let speechTimer: number | undefined;
function say(text: string) {
  const el = $('#speech');
  el.textContent = text;
  el.dataset.hidden = 'false';
  clearTimeout(speechTimer);
  speechTimer = window.setTimeout(() => (el.dataset.hidden = 'true'), 3200);
}

const me = activeSparkling(s);
try {
  const scene = new SparklingScene($('#scene'), {
    layout: 'room',
    birth: false,
    variant: variantById(me.variant),
    tier: me.tier,
    accessories: outfitOf(me),
    onPoke: () => {
      scene.react('poke');
      if (Math.random() < 0.4) say(POKED[Math.floor(Math.random() * POKED.length)]);
    },
    frame: $('#plain'),
    hitArea: $('#plain'),
  });
  for (const sub of SUBJECTS) scene.setRingProgress(sub.id, ringFraction(s, sub.id), true);
  scene.setEnergy(s.fullness / 100, true);
  scene.setGold(goldFraction(s), goldResting(s), true);
  scene.setBoosts(catalog().boosts.map((b) => b.kind));
  scene.setRoom(roomView(s));
  $('#reset-view').addEventListener('click', () => scene.resetView());
  setTimeout(() => say('Welcome to Spark Island!'), 600);
} catch (err) {
  console.error(err);
  $('#scene').innerHTML = '<div class="grid h-full place-items-center p-6 text-center text-sm opacity-70">This demo needs WebGL to draw the island.</div>';
}
