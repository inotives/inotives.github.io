import { useEffect, useRef, useState } from 'react'
import { parseDate, toIsoDate } from '../utils/dates'
import { loadThree, prefersReducedMotion } from '../utils/three'
const POINT_COUNT = 4096

const SIGNAL = [0.122, 0.937, 0.843]
const AMBER = [0.965, 0.769, 0.325]
const FOG = [0.32, 0.34, 0.38]

const SCENE_CAPTIONS = {
  stream: 'Data moving through pipelines',
  network: 'Five enterprise data sources behind one AI endpoint',
  coins: 'Five stablecoin launches: PAXG, USDP, BUSD, PYUSD, USDL',
  grid: 'A web page drawn as a grid of components',
  clusters: 'Three open-source projects: OpenVAIA, agent-rig, strata-memory',
  agents: 'A planner handing work to agents and back',
  lattice: 'Warehouse tables: rows, columns and models',
  notes: 'Every note on this site, one column per day',
}

// Deterministic pseudo-random so formations look the same on every visit
function random(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function gaussian(seed) {
  return (random(seed) + random(seed + 1.7) + random(seed + 3.1) - 1.5) * 1.15
}

function formation(name, posts) {
  const pos = new Float32Array(POINT_COUNT * 3)
  const col = new Float32Array(POINT_COUNT * 3)
  const set = (i, x, y, z, c) => {
    pos.set([x, y, z], i * 3)
    col.set(c, i * 3)
  }

  if (name === 'network') {
    const sources = 5
    for (let i = 0; i < POINT_COUNT; i++) {
      const r = random(i)
      if (i < 600) {
        // hub: the single AI endpoint
        const s = 0.5 * Math.cbrt(random(i + 9))
        set(i, gaussian(i) * s, gaussian(i + 2) * s, gaussian(i + 4) * s, AMBER)
      } else {
        const k = i % sources
        const angle = (k / sources) * Math.PI * 2 + 0.3
        const sx = Math.cos(angle) * 3.2
        const sy = Math.sin(angle) * 2.2
        const sz = Math.sin(angle * 2) * 0.8
        if (r < 0.45) {
          const s = 0.38
          set(i, sx + gaussian(i) * s, sy + gaussian(i + 2) * s, sz + gaussian(i + 4) * s, SIGNAL)
        } else {
          // edges from each source into the hub
          const t = random(i + 5)
          const j = 0.05
          set(i, sx * t + gaussian(i) * j, sy * t + gaussian(i + 2) * j, sz * t + gaussian(i + 4) * j, FOG)
        }
      }
    }
  } else if (name === 'coins') {
    const coins = 5
    for (let i = 0; i < POINT_COUNT; i++) {
      const k = i % coins
      const u = random(i) * Math.PI * 2
      const v = random(i + 1) * Math.PI * 2
      const ring = 0.62 + 0.13 * Math.cos(v)
      const tilt = 0.35 + k * 0.25
      const lx = ring * Math.cos(u)
      const ly = ring * Math.sin(u)
      const lz = 0.13 * Math.sin(v)
      const x = (k - 2) * 1.6
      set(
        i,
        x + lx,
        ly * Math.cos(tilt) - lz * Math.sin(tilt) + (k % 2 ? 0.5 : -0.5),
        ly * Math.sin(tilt) + lz * Math.cos(tilt),
        k === 2 ? AMBER : SIGNAL
      )
    }
  } else if (name === 'grid') {
    // header, sidebar and content blocks of a page layout
    const blocks = [
      [-3, 1.6, 6, 0.5],
      [-3, -1.9, 1.6, 3.2],
      [-1.1, 0.4, 4.1, 0.9],
      [-1.1, -0.9, 1.9, 1.0],
      [1.1, -0.9, 1.9, 1.0],
      [-1.1, -1.9, 4.1, 0.6],
    ]
    for (let i = 0; i < POINT_COUNT; i++) {
      const b = blocks[i % blocks.length]
      const edge = random(i + 3) < 0.55
      let x = b[0] + random(i) * b[2]
      let y = b[1] + random(i + 1) * b[3]
      if (edge) {
        if (random(i + 4) < 0.5) y = random(i + 5) < 0.5 ? b[1] : b[1] + b[3]
        else x = random(i + 5) < 0.5 ? b[0] : b[0] + b[2]
      }
      set(i, x, y, gaussian(i + 6) * 0.06, edge ? SIGNAL : FOG)
    }
  } else if (name === 'clusters') {
    const centers = [
      [-2.2, 0.8, 0, 0.75, AMBER],
      [1.9, 1.1, -0.4, 0.5, SIGNAL],
      [0.4, -1.5, 0.5, 0.45, SIGNAL],
    ]
    for (let i = 0; i < POINT_COUNT; i++) {
      if (i < 3200) {
        const c = centers[i % 3]
        set(i, c[0] + gaussian(i) * c[3], c[1] + gaussian(i + 2) * c[3], c[2] + gaussian(i + 4) * c[3], c[4])
      } else {
        set(i, (random(i) - 0.5) * 9, (random(i + 1) - 0.5) * 6, (random(i + 2) - 0.5) * 4, FOG)
      }
    }
  } else if (name === 'agents') {
    // planner at the centre, worker agents on an orbit, task paths between them
    const workers = 6
    for (let i = 0; i < POINT_COUNT; i++) {
      if (i < 500) {
        const s = 0.35
        set(i, gaussian(i) * s, gaussian(i + 2) * s, gaussian(i + 4) * s, AMBER)
      } else {
        const k = i % workers
        const a = (k / workers) * Math.PI * 2
        const wx = Math.cos(a) * 2.6
        const wy = Math.sin(a) * 1.8
        if (random(i) < 0.5) {
          const s = 0.22
          set(i, wx + gaussian(i) * s, wy + gaussian(i + 2) * s, gaussian(i + 4) * s, SIGNAL)
        } else {
          const t = random(i + 5)
          const bow = Math.sin(t * Math.PI) * 0.6
          set(i, wx * t - Math.sin(a) * bow, wy * t + Math.cos(a) * bow, 0, FOG)
        }
      }
    }
  } else if (name === 'lattice') {
    const side = 16
    for (let i = 0; i < POINT_COUNT; i++) {
      const x = i % side
      const y = Math.floor(i / side) % side
      const z = Math.floor(i / (side * side))
      const header = y === side - 1
      set(i, (x - 7.5) * 0.3, (y - 7.5) * 0.24, (z - 7.5) * 0.3, header ? AMBER : z % 4 === 0 ? SIGNAL : FOG)
    }
  } else if (name === 'notes') {
    // the publishing heatmap, raised into bars by notes per day
    const byDay = {}
    posts.forEach((p) => p.date && (byDay[p.date] = (byDay[p.date] || 0) + 1))
    const dates = Object.keys(byDay).sort()
    const cells = []
    if (dates.length) {
      const start = parseDate(dates[0])
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
      const end = parseDate(dates[dates.length - 1])
      for (let d = new Date(start), n = 0; d <= end; d.setDate(d.getDate() + 1), n++) {
        cells.push({ week: Math.floor(n / 7), dow: n % 7, count: byDay[toIsoDate(d)] || 0 })
      }
    }
    const weeks = cells.length ? cells[cells.length - 1].week + 1 : 1
    const columns = []
    cells.forEach((c) => {
      const x = (c.week - weeks / 2) * 0.24
      const z = (c.dow - 3) * 0.24
      columns.push([x, -1.4, z, FOG])
      for (let h = 1; h <= c.count * 5; h++) {
        columns.push([x, -1.4 + h * 0.09, z, c.count >= 3 ? AMBER : SIGNAL])
      }
    })
    for (let i = 0; i < POINT_COUNT; i++) {
      const c = columns.length ? columns[i % columns.length] : [0, 0, 0, FOG]
      set(i, c[0], c[1], c[2], c[3])
    }
  } else {
    // stream: ribbons of data flowing left to right
    const ribbons = 7
    for (let i = 0; i < POINT_COUNT; i++) {
      const k = i % ribbons
      const x = -4.5 + random(i) * 9
      const y = Math.sin(x * 0.9 + k * 0.8) * 0.55 + (k - 3) * 0.42
      const z = Math.cos(x * 0.7 + k) * 0.7
      set(i, x, y + gaussian(i + 1) * 0.04, z + gaussian(i + 2) * 0.04, k === 3 ? AMBER : random(i + 3) < 0.7 ? SIGNAL : FOG)
    }
  }

  return { pos, col }
}

export default function AboutScene({ scene, posts }) {
  const containerRef = useRef(null)
  const sceneRef = useRef(scene)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    sceneRef.current = scene
  }, [scene])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    let disposed = false
    let cleanup = () => {}

    loadThree()
      .then((THREE) => {
        if (disposed) return
        const reduceMotion = prefersReducedMotion()

        let renderer
        try {
          renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
        } catch {
          setFailed(true)
          return
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(renderer.domElement)

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
        camera.position.set(0, 0.4, 9)
        const world = new THREE.Scene()
        const group = new THREE.Group()
        world.add(group)

        const formations = {}
        const getFormation = (name) => (formations[name] ||= formation(name, posts))
        const first = getFormation(sceneRef.current)
        const current = { pos: first.pos.slice(), col: first.col.slice() }

        const geometry = new THREE.BufferGeometry()
        // rendered positions = eased positions + wobble, kept separate so wobble never accumulates
        const posAttr = new THREE.BufferAttribute(first.pos.slice(), 3)
        const colAttr = new THREE.BufferAttribute(current.col, 3)
        geometry.setAttribute('position', posAttr)
        geometry.setAttribute('color', colAttr)
        const material = new THREE.PointsMaterial({
          size: 0.045,
          vertexColors: true,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        group.add(new THREE.Points(geometry, material))

        const resize = () => {
          const { clientWidth: w, clientHeight: h } = container
          if (!w || !h) return
          renderer.setSize(w, h, false)
          camera.aspect = w / h
          // pull back on narrow screens so formations stay in frame
          camera.position.z = w / h < 1 ? 9 / Math.max(w / h, 0.55) : 9
          camera.updateProjectionMatrix()
        }
        const observer = new ResizeObserver(resize)
        observer.observe(container)
        resize()

        const pointer = { x: 0, y: 0 }
        const onPointer = (e) => {
          pointer.x = (e.clientX / window.innerWidth) * 2 - 1
          pointer.y = (e.clientY / window.innerHeight) * 2 - 1
        }
        window.addEventListener('pointermove', onPointer)

        let frame
        let spin = 0
        const tick = (time) => {
          const target = getFormation(sceneRef.current)
          const ease = reduceMotion ? 1 : 0.055
          const wobble = reduceMotion ? 0 : 0.012
          const t = time * 0.001
          for (let i = 0; i < current.pos.length; i++) {
            current.pos[i] += (target.pos[i] - current.pos[i]) * ease
            current.col[i] += (target.col[i] - current.col[i]) * ease
          }
          for (let i = 0; i < POINT_COUNT; i++) {
            posAttr.array[i * 3] = current.pos[i * 3]
            posAttr.array[i * 3 + 1] = current.pos[i * 3 + 1] + Math.sin(t * 1.3 + i * 0.37) * wobble
            posAttr.array[i * 3 + 2] = current.pos[i * 3 + 2]
          }
          posAttr.needsUpdate = true
          colAttr.needsUpdate = true

          if (!reduceMotion) spin += 0.0012
          group.rotation.y += (spin + pointer.x * 0.35 - group.rotation.y) * 0.05
          group.rotation.x += (pointer.y * 0.2 - group.rotation.x) * 0.05
          renderer.render(world, camera)
          frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)

        cleanup = () => {
          cancelAnimationFrame(frame)
          observer.disconnect()
          window.removeEventListener('pointermove', onPointer)
          geometry.dispose()
          material.dispose()
          renderer.dispose()
          renderer.domElement.remove()
        }
      })
      .catch(() => {
        if (!disposed) setFailed(true)
      })

    return () => {
      disposed = true
      cleanup()
    }
  }, [posts])

  return (
    <div className="about-scene" aria-hidden="true">
      <div ref={containerRef} className="about-scene-canvas" />
      {!failed && <p className="about-scene-caption">{SCENE_CAPTIONS[scene]}</p>}
    </div>
  )
}
