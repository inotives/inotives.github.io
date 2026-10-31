// UI experiments shown on /playground. Each mock is a self-contained HTML file in
// public/mocks/ running on mock data; `libraries` lists the ids it is built with,
// `credit` names whose design a mock is based on, and `usedIn` says which of my projects
// uses the UI (with its repo when it is public), and `sources` links where a mock's real figures come from.

export const PLAYGROUND_LIBRARIES = [
  {
    id: 'd3',
    name: 'D3',
    kind: 'Data visualization',
    description: 'Layouts, scales and map projections for data, here feeding Sankey, chord and map layouts into Three.js.',
    site: 'https://d3js.org',
    repo: 'd3/d3',
  },
  {
    id: 'chartjs',
    name: 'Chart.js',
    kind: 'Charting',
    description: 'Canvas charts from a config object: scales, legends and tooltips out of the box. Here its layout drives 3D geometry in Three.js.',
    site: 'https://www.chartjs.org',
    repo: 'chartjs/Chart.js',
  },
  {
    id: 'threejs',
    name: 'Three.js',
    kind: '3D graphics',
    description: 'JavaScript 3D library over WebGL: scenes, cameras, materials and animation in the browser.',
    site: 'https://threejs.org',
    repo: 'mrdoob/three.js',
  },
  {
    id: 'daisyui',
    name: 'daisyUI',
    kind: 'Component library',
    description: 'Component classes and themes for Tailwind CSS. Loads from a CDN with no build step.',
    site: 'https://daisyui.com',
    repo: 'saadeghi/daisyui',
  },
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    kind: 'Component library',
    description:
      'Copy-paste React components built on Radix and Tailwind, themed with design tokens you own.',
    site: 'https://ui.shadcn.com',
    repo: 'shadcn-ui/ui',
  },
  {
    id: 'openui',
    name: 'OpenUI',
    kind: 'Generative UI',
    description:
      'An open standard for AI apps and agents to answer with interactive UI instead of text, using your own components and design system. From Thesys.',
    site: 'https://www.openui.com',
    repo: 'thesysdev/openui',
  },
  {
    id: 'flaticon',
    name: 'Flaticon UIcons',
    kind: 'Icon set',
    description: 'Over 4,000 interface icons as a web font or SVG, loaded from a CDN with one stylesheet.',
    site: 'https://www.flaticon.com/uicons',
    repo: 'freepik-company/flaticon-uicons',
  },
  {
    id: 'pretext',
    name: 'Pretext',
    kind: 'Text layout',
    description:
      'Measures and lays out multiline text without touching the DOM, so there is no layout reflow. Renders to DOM, Canvas or SVG. By Cheng Lou.',
    site: 'https://chenglou.me/pretext/',
    repo: 'chenglou/pretext',
  },
  {
    id: 'tailwind',
    name: 'Tailwind CSS',
    kind: 'CSS framework',
    description: 'Utility-first CSS. The v4 browser build compiles classes at runtime, so mocks need no bundler.',
    site: 'https://tailwindcss.com',
    repo: 'tailwindlabs/tailwindcss',
  },
]

export const PLAYGROUND_MOCKS = [
  {
    id: 'agent-core-galaxy',
    project: 'Agent Core',
    name: 'Galaxy dashboard',
    date: '2026-10-31',
    href: '/mocks/agent-core.html?view=galaxy',
    preview: '/mocks/previews/agent-core-galaxy.jpg',
    description:
      'An agentic OS home screen: a Three.js memory graph inside a ring of capability buttons, with calendar, email, skills, databases and workflow panels. Click a note to read it in the side drawer.',
    libraries: ['daisyui', 'tailwind', 'threejs'],
    credit: { name: 'Jay E (RoboNuggets)', href: 'https://www.youtube.com/@RoboNuggets' },
  },
  {
    id: 'agent-core-brain',
    project: 'Agent Core',
    name: 'Second brain',
    date: '2026-10-31',
    href: '/mocks/agent-core.html?view=brain',
    preview: '/mocks/previews/agent-core-brain.jpg',
    description:
      'The same memory drawn as rings around the agent core, switchable to a sphere, beside agent status and the day’s workflow timeline. Styled with shadcn/ui design tokens recreated in plain HTML.',
    libraries: ['shadcn', 'tailwind', 'threejs'],
    usedIn: { text: 'The UI for my personal agentic second brain project.' },
  },
  {
    id: 'agent-core-sphere',
    project: 'Agent Core',
    name: 'Memory sphere',
    date: '2026-10-31',
    href: '/mocks/agent-core-sphere.html',
    preview: '/mocks/previews/agent-core-sphere.jpg',
    description:
      'Two slowly turning wireframe globes: memory notes clustered in the core, and the apps, skills and routines that use them on the outer shell, each drawn as its own icon. Select a node to trace its links.',
    libraries: ['threejs', 'flaticon'],
  },
  {
    id: 'spark-island',
    project: 'Sparkling',
    name: 'Spark Island',
    date: '2026-10-31',
    href: '/mocks/spark-island.html',
    preview: '/mocks/previews/spark-island.jpg',
    description:
      'A kid’s home island in a gamified learning app: a voxel island with floating islets, decorations and a robot companion, over daily tasks, care meters and subject levels. Drag to turn the island and tap Sparkling to say hi.',
    libraries: ['threejs', 'daisyui', 'tailwind', 'flaticon'],
    usedIn: { text: 'From my personal project, a gamified quiz app for kids in Primary 1 to 6.' },
  },
  {
    id: 'inoai-console',
    project: 'inoai',
    name: 'Ring console',
    date: '2026-10-31',
    href: '/mocks/inoai.html',
    preview: '/mocks/previews/inoai.jpg',
    description:
      'The home screen of a personal AI agent: health, activity and failures drawn as glowing rings around a voxel robot, with tasks, memory and skills below. Tap a ring or the status chip to open the side panel, with demo data in every section.',
    libraries: ['threejs', 'flaticon'],
    usedIn: { text: 'The primary UI of my InoAI project.', repo: 'inotives/inoai' },
  },
  {
    id: 'data-3d-flows',
    project: 'Data in 3D',
    name: 'Trade map',
    date: '2026-10-31',
    href: '/mocks/data-3d.html?view=flows',
    preview: '/mocks/previews/data-3d-flows.jpg',
    description:
      'A world map lying flat with a Sankey diagram standing behind it: chip exports lift off the map, split by kind of chip and drop back down to the markets that buy them. Tap a country or flow to trace it.',
    libraries: ['d3', 'threejs', 'shadcn', 'tailwind'],
  },
  {
    id: 'data-3d-deps',
    project: 'Data in 3D',
    name: 'Dependency sphere',
    date: '2026-10-31',
    href: '/mocks/data-3d.html?view=deps',
    preview: '/mocks/previews/data-3d-deps.jpg',
    description:
      'A chord diagram wrapped onto a sphere: each package of a mock web app gets a slice sized by its traffic, and imports bundle through the middle. Pick a module to see what it imports and what imports it.',
    libraries: ['d3', 'threejs', 'shadcn', 'tailwind'],
  },
  {
    id: 'binance-hack-map',
    project: 'Chain forensics',
    name: 'Binance hack map',
    date: '2026-10-31',
    href: '/mocks/binance-hack-map.html',
    preview: '/mocks/previews/binance-hack-map.jpg',
    description:
      'An investigation map of the October 29, 2026 Binance hack: one lane per chain, time left to right, frozen funds sinking below the floor and laundered funds rising above it. Red rings mark the likely exits: wallets holding coins no issuer can freeze. Replay the night or pick a wallet to follow its money. Figures from TRM Labs’ report, with gaps marked as estimates.',
    libraries: ['threejs', 'd3', 'shadcn', 'tailwind', 'flaticon'],
    sources: [
      { name: 'TRM Labs', href: 'https://www.trmlabs.com/resources/blog/north-korea-steals-usd-6-36-billion-from-binance-in-the-largest-hack-in-history' },
      { name: 'CNBC', href: 'https://www.cnbc.com/2026/10/30/billions-in-crypto-frozen-in-binance-hack-heres-what-happens-next-.html' },
      { name: 'Wikipedia', href: 'https://en.wikipedia.org/wiki/2026_Binance_hack' },
    ],
  },
  {
    id: 'anthropic-ipo',
    project: 'IPO watch',
    name: 'ANT IPO explorer',
    date: '2026-10-31',
    href: '/mocks/anthropic-ipo.html',
    preview: '/mocks/previews/anthropic-ipo.jpg',
    description:
      'Anthropic’s S-1 in 3D: cubes sized by revenue, losses, compute commitments and valuation, the prediction-market odds for day one, scenario paths for the first week, and the levels to watch once the dust settles. Scenarios are illustrative, not advice; built with Claude, which Anthropic makes.',
    libraries: ['threejs', 'd3', 'shadcn', 'tailwind', 'flaticon'],
    sources: [
      { name: 'SEC S-1', href: 'https://www.sec.gov/Archives/edgar/data/0002130357/000162828026067168/anthropicpbc-sx1.htm' },
      { name: 'CNBC', href: 'https://www.cnbc.com/2026/10/26/anthropic-ipo-live-updates-ai-s-1-filing.html' },
      { name: 'Polymarket odds', href: 'https://finance.yahoo.com/markets/stocks/articles/polymarket-traders-cool-2-trillion-110000808.html' },
    ],
  },
  {
    id: 'chart-agent',
    project: 'Chat analytics',
    name: 'Chart agent',
    date: '2026-11-01',
    href: '/mocks/chart-agent.html',
    preview: '/mocks/previews/chart-agent.jpg',
    description:
      'A chat window where an analytics agent answers with charts. It calls tools on the MCP servers you have connected, then writes its reply in OpenUI Lang, which renders line by line into a card with a D3 or Three.js chart. Open a chart to explore it, save it to My charts and pull it back later with fresh data. A mock: replies are scripted and every figure is generated.',
    libraries: ['openui', 'd3', 'threejs', 'shadcn', 'tailwind', 'flaticon'],
  },
  {
    id: 'brand-kit',
    project: 'inoTives',
    name: 'Brand kit',
    date: '2026-11-01',
    href: '/mocks/brand-kit.html',
    preview: '/mocks/previews/brand-kit.jpg',
    description:
      'The inoTives design system written down, as an example of the brand kit every company should keep: concept, color tokens with live contrast checks, the data palette and ramps, fonts and type scale, and number and date formats. Then the same brand applied in shadcn/ui tokens, a D3 theme helper and Three.js scene rules, with toggles that show each library’s defaults, plus a Flaticon base icon set. Copy any value or download the tokens.',
    libraries: ['shadcn', 'd3', 'threejs', 'tailwind', 'flaticon'],
  },
  {
    id: 'chartjs-3d',
    project: 'Data in 3D',
    name: 'Chart.js in 3D',
    date: '2026-11-01',
    href: '/mocks/chartjs-3d.html',
    preview: '/mocks/previews/chartjs-3d.jpg',
    description:
      'Chart.js charts lifted into 3D: a radar lofted across six months, a multi-axis line chart with each axis on its own panel, a polar area with sectors extruded by a second value, and grouped bars set out in rows. Chart.js lays out scales, labels and every point on hidden canvases; Three.js uses those canvases as textures and builds the geometry from the positions Chart.js computed. Each view opens the original interactive Chart.js chart.',
    libraries: ['chartjs', 'threejs', 'shadcn', 'tailwind', 'flaticon'],
  },
  {
    id: 'd3-3d',
    project: 'Data in 3D',
    name: 'D3 in 3D',
    date: '2026-11-01',
    href: '/mocks/d3-3d.html',
    preview: '/mocks/previews/d3-3d.jpg',
    description:
      'Four 3D charts where D3 does the data work and Three.js draws: a chain profile wrapped around a sphere, with scores grouped by direction and colored against a benchmark, seven years of real US Treasury yield curves stacked month by month (watch 2022 turn the curve upside down), a bubble chart in a box, and a world map of 2026 GDP as stacked bars with a Sankey that splits the top 20 economies into services, industry and agriculture and flows each part into its country. GDP from the IMF’s October 2026 outlook; sector shares approximate.',
    libraries: ['d3', 'threejs', 'shadcn', 'tailwind', 'flaticon'],
    sources: [
      { name: 'IMF WEO, Oct 2026', href: 'https://www.imf.org/en/publications/weo/issues/2026/10/13/world-economic-outlook-october-2026' },
      { name: 'Worldometer table', href: 'https://www.worldometers.info/gdp/gdp-by-country/?region=worldwide&year=2026&metric=nominal' },
      { name: 'World Bank WDI', href: 'https://data.worldbank.org/indicator/NV.SRV.TOTL.ZS' },
      { name: 'US Treasury yield curve', href: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve' },
    ],
  },
]
