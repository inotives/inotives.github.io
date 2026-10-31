// UI experiments shown on /playground. Each mock is a self-contained HTML file in
// public/mocks/ running on mock data; `libraries` lists the ids it is built with,
// and `credit` names whose design a mock is based on.

export const PLAYGROUND_LIBRARIES = [
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
  },
]
