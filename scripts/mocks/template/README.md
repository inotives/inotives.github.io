# Playground mock template

The Playground (`/playground`) lists UI experiments. Each one is a **single, self-contained HTML
file** in `public/mocks/`, listed in `src/data/playground.js`. This folder holds the standard
they share:

| File | What it is |
| --- | --- |
| `playground.html` | Starter mock: brand tokens, header, stage, side panel / drawer, legend, toast, IndexedDB helper and a small Three.js demo. Copy it to start a new mock. |
| `check.mjs` | Checks that every mock carries the current layout standard. `--write` copies it in. |
| `README.md` | This guide. |

## Start a new mock

1. Copy `playground.html` to `public/mocks/<id>.html`.
2. Set the `<title>` (two to four words), the header subtitle (`Playground · …`), the drawer
   title in `.pg-drawer-head`, and the comment at the top that says what the mock draws and where
   its data comes from.
3. Set the panel width: `#drawer { --pg-panel-w: 360px; }` (desktop card), and
   `--pg-drawer-w` if the phone drawer should differ (default 360px, capped at 88vw).
4. Rename the IndexedDB database (`IDB.name = 'inotives-<id>'`).
5. Replace the demo section of the module script.
6. Add the entry to `PLAYGROUND_MOCKS` in `src/data/playground.js` and a preview image (below).
7. Run `node scripts/mocks/template/check.mjs`; it should say `ok` for the new file.

Mocks in `public/` open as-is from the dev server (`/mocks/<id>.html`). To preview the template
itself, serve this folder statically (`python3 -m http.server -d scripts/mocks/template`): the
Vite dev server rewrites HTML outside `public/` and cannot resolve the CDN import map.

## Stack

Load everything from CDNs with pinned versions, as the template does. No build step.

Included in the template:

- Tailwind CSS v4 browser build `@tailwindcss/browser@4.3.3`, with the brand tokens in `@theme`
- shadcn/ui, recreated in plain HTML with Tailwind classes (no React): the token names in
  `@theme` and helpers like `kpi()` and `section()`
- Three.js `0.180.0` through an import map (`three`, `three/addons/`), with `OrbitControls` and
  `CSS2DRenderer` for HTML labels pinned in 3D (`label(parent, html, x, y, z)`, styled by `.lbl`)
- D3 `7.9.0` for scales, colour ramps and number formats
- Flaticon UIcons `3.0.0`, `uicons-regular-rounded` set for the UI

Optional, commented out in the template's `<head>`; uncomment what the mock needs:

| Library | Version | For | Used in |
| --- | --- | --- | --- |
| Flaticon UIcons brands | `3.0.0` | Brand and chain logos (`fi-brands-bitcoin`) | block-explorer |
| Leaflet | `1.9.4` | Street maps beside the 3D view | sg-hdb-3d, sg-pulse |
| Chart.js | `4.4.7` | Chart.js charts, e.g. as textures in 3D | chartjs-3d |

One-offs stay out of the template: OpenUI (chart-agent) and daisyUI (agent-core, which predates
the shadcn/ui look). Prefer the shadcn/ui look for new mocks.

Fonts are IBM Plex Sans Condensed (UI), Source Code Pro (numbers, ids, labels) and VT323 (the
`inoTives` wordmark). Colour, type and formatting rules are in the Brand kit mock
(`/mocks/brand-kit.html`): dark paper `#15171b`, cards `#1d2026`, one signal colour `#1fefd7`
that only means live, selected or linked, amber `#f6c453` and pink `#e58fb0` for data.

## Layout standard

Three regions sit over a full-screen stage:

```
┌ header ─────────────────────────────────────────────────────────────┐
│ ☰ (phones)  inoTives  Playground · Name     [ tabs ]     [actions] │
├────────────┬────────────────────────────────────────────────────────┤
│ #drawer    │  #stage (Three.js canvas, CSS2D labels)                │
│  #panel    │                                                        │
│            │                                          ┌ #legend ─┐  │
└────────────┴──────────────────────────────────────────┴──────────┴──┘
```

**From 900px wide** the side panel is a floating card on the left (`.pg-float`), and the stage
view is shifted right by half the panel width (`camera.setViewOffset`) so content centres in the
free space. The legend sits bottom right.

**Below 900px** the side panel is a drawer that slides in from the left over a scrim, and is
closed by default so the stage gets the whole screen:

- the header shows a menu button (`#drawer-btn`) and hides the wordmark; the wordmark, the mock
  name and a close button (`#drawer-close`) move into the drawer head
- the stage legend is hidden and folded into the drawer, under the panel (`#drawer-legend`
  mirrors `#legend` automatically)
- the drawer closes from the close button, the scrim, Escape, a link to an `#anchor` or any
  `[data-drawer-close]` element inside it, and when the window widens past 900px
- tabs show icons only below the `sm` breakpoint, with the name in `aria-label`
- camera offsets are cleared: nothing on the stage is covered while the drawer is closed

Mock code can call `window.pgDrawer.open()` and `window.pgDrawer.close()`.

### Markup contract

```html
<button id="drawer-btn" class="pg-drawer-btn …" aria-controls="drawer" aria-expanded="false">…</button>
<a href="/playground" class="pg-hide-mobile …">inoTives</a>

<aside id="drawer" class="pg-drawer pg-float …">
  <div class="pg-drawer-head">wordmark · mock name · <button id="drawer-close">…</button></div>
  <div id="panel" class="… overflow-auto">…</div>   <!-- the mock renders here -->
  <div id="drawer-legend" class="pg-drawer-legend"></div>
</aside>
<div id="scrim" class="pg-scrim"></div>
<div id="legend" class="pg-legend …"></div>
```

Render panel content into `#panel` (it is also the scroll container). Do not put whitespace
inside `#drawer-legend`; it is hidden while empty.

**App-style layouts** use the same drawer without `.pg-float`: the element is a normal column
from 900px and the drawer below. Chart agent's sidebar (`<aside id="drawer" class="pg-drawer …">`
with its own header and close button) and Brand kit's section nav are the examples.

### The standard blocks

The CSS between `/* <pg-layout v1> */ … /* </pg-layout> */` and the script between
`/* <pg-layout-js v1> */ … /* </pg-layout-js> */` must be identical in every mock. To change the
standard, edit `playground.html`, bump the version in both markers if the change is not
backwards compatible, then run:

```bash
node scripts/mocks/template/check.mjs --write   # copy the blocks into every mock that has them
node scripts/mocks/template/check.mjs           # confirm: every listed mock says ok
```

Mocks without the markers (made before November 2026) are listed and left alone.

## Panel content

- Start with the subject as a short heading and one line of context; then KPI tiles
  (`kpi(label, value, sub)` in a 2-column grid), then titled sections (`section(title, body, icon)`).
- shadcn/ui look: `rounded-lg border bg-background/40` cards, `bg-muted` toggle groups with a
  `data-[state=active]` background, 32px buttons, `text-xs` muted helper text.
- Numbers, hashes and ids in Source Code Pro; shorten long ids in the middle (`0x4838b1…ad5f97`)
  and offer copy.
- Sentence case, plain words, no exclamation marks. Say where figures come from.
- Link out to the canonical source for an item where there is one (an explorer, a dataset page).

## Stage

- Dark radial background on `#stage`; hemisphere light plus one key light.
- Use `InstancedMesh` for anything with more than a few hundred items, and pick by `instanceId`.
- Hover shows `#tip` near the pointer (mouse only); a click without drag selects.
- Respect `prefers-reduced-motion`: no ambient animation and no camera flights.
- Dispose geometries, materials and CSS2D label elements when a view is rebuilt.
- Frame each view with the free width and height in mind (panel on the left, header on top).

## Data

- Real data where it exists, generated data only when it says so. Credit sources in the mock's
  comment, in the panel, and in `sources` in `playground.js`.
- Bundle captured data in `public/mocks/data/<id>.json`. Put the capture or build script in
  `scripts/mocks/<id>/`, and have it reuse the mock's own loaders when the mock can also fetch
  live (see `scripts/mocks/block-explorer/capture.mjs`).
- **Anything the mock stores goes in the browser datastore (IndexedDB), and live data syncs into
  it.** The page reopens on the last synced data; the bundled file is only the fallback. Wrap
  every storage call in try/catch so the page still works when storage is blocked, and give the
  person a way to clear what is stored.
- Keep bundled data reasonable (aim for under ~1 MB gzipped).

## Preview image

`public/mocks/previews/<id>.jpg`, **1200 × 601 JPEG**, about 80–150 KB, showing the mock at
desktop width with the panel open. One way: load the mock in a 1200 × 601 iframe, screenshot
that region, and convert it (`sips -z 601 1200 -s format jpeg -s formatOptions 82 in.png --out <id>.jpg`).

## Before committing

- [ ] Desktop: panel, tabs, legend, tooltips and selection work; nothing hides behind the panel.
- [ ] Phone width (390px): drawer closed by default, opens from ☰, legend is in the drawer,
      closes from ×, scrim and Escape; header fits.
- [ ] `node scripts/mocks/template/check.mjs` says `ok` for the mock.
- [ ] No console errors; reduced motion stops ambient animation.
- [ ] `playground.js` entry, preview image and sources are in place; `npm run lint` and
      `npm run build` pass.
