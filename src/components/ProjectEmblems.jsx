import { useEffect, useRef } from 'react'
import { getAllPosts } from '../utils/content'
import { parseDate, toIsoDate } from '../utils/dates'
import { loadThree, prefersReducedMotion } from '../utils/three'

// One fixed WebGL canvas draws every project emblem into the on-screen rect
// of its placeholder (<div data-emblem="…">), so five emblems cost one context.
// Each builder returns { scene, camera, update(t, active) }; `active` is true
// while the reader hovers that project's listing.

const SIGNAL = 0x1fefd7
const AMBER = 0xf6c453
const BONE = 0xe4e1d8
const FOG = 0x8b9099
const SLATE = 0x2b2f37

function baseScene(THREE, cameraZ = 6.2) {
  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight(0xffffff, 0.7))
  const sun = new THREE.DirectionalLight(0xffffff, 1.4)
  sun.position.set(-3, 5, 4)
  scene.add(sun)
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
  camera.position.set(0, 1.6, cameraZ)
  camera.lookAt(0, 0, 0)
  return { scene, camera }
}

const mat = (THREE, color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.15, ...extra })

// Agent Rig: planner, worker and reviewer pass a work packet around a loop
// inside the .agent-rig/ workspace box
function buildLoop(THREE) {
  const { scene, camera } = baseScene(THREE)
  const group = new THREE.Group()
  group.scale.setScalar(0.85)
  scene.add(group)
  group.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.4, 2.2, 3.4)),
      new THREE.LineBasicMaterial({ color: FOG, transparent: true, opacity: 0.5 })
    )
  )
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.025, 8, 80), mat(THREE, SLATE))
  ring.rotation.x = Math.PI / 2
  group.add(ring)
  const roles = [AMBER, SIGNAL, BONE].map((color, i) => {
    const node = new THREE.Mesh(new THREE.OctahedronGeometry(0.26), mat(THREE, color))
    const a = (i / 3) * Math.PI * 2
    node.position.set(Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15)
    group.add(node)
    return node
  })
  const packet = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mat(THREE, SIGNAL, { emissive: SIGNAL, emissiveIntensity: 0.6 }))
  group.add(packet)
  let phase = 0
  return {
    scene,
    camera,
    update(t, dt, active) {
      phase += dt * (active ? 1.6 : 0.5)
      const a = phase % (Math.PI * 2)
      packet.position.set(Math.cos(a) * 1.15, 0.05, Math.sin(a) * 1.15)
      roles.forEach((node, i) => {
        const near = Math.cos(a - (i / 3) * Math.PI * 2)
        node.scale.setScalar(1 + Math.max(0, near) ** 8 * 0.5)
        node.rotation.y = t * 0.8 + i
      })
      group.rotation.y = t * 0.15
    },
  }
}

// Trinary Agents: tasks light up in dependency order, built (cyan) then reviewed (amber)
function buildDag(THREE) {
  const { scene, camera } = baseScene(THREE, 6.6)
  const group = new THREE.Group()
  // the graph is wider than tall; scale it to sit inside a square frame
  group.scale.setScalar(0.72)
  group.position.x = -0.1
  scene.add(group)
  const layout = [
    [-1.8, 0.6],
    [-1.8, -0.6],
    [-0.4, 0.9],
    [-0.4, -0.3],
    [1.0, 0.3],
    [2.0, 0.3],
  ]
  const depth = [0, 0, 1, 1, 2, 3]
  const edges = [
    [0, 2],
    [0, 3],
    [1, 3],
    [2, 4],
    [3, 4],
    [4, 5],
  ]
  const tasks = layout.map(([x, y]) => {
    const material = mat(THREE, SLATE)
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), material)
    cube.position.set(x, y, 0)
    group.add(cube)
    return { cube, material }
  })
  const lineMaterial = new THREE.LineBasicMaterial({ color: FOG })
  edges.forEach(([a, b]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([tasks[a].cube.position, tasks[b].cube.position])
    group.add(new THREE.Line(geometry, lineMaterial))
  })
  const slate = new THREE.Color(SLATE)
  const cyan = new THREE.Color(SIGNAL)
  const amber = new THREE.Color(AMBER)
  let clock = 0
  return {
    scene,
    camera,
    update(t, dt, active) {
      clock += dt * (active ? 2.4 : 1)
      const cycle = clock % 9
      tasks.forEach(({ cube, material }, i) => {
        const built = cycle > depth[i] + 0.5
        const reviewed = cycle > depth[i] + 4.5
        material.color.copy(reviewed ? amber : built ? cyan : slate)
        cube.rotation.set(t * 0.4 + i, t * 0.3, 0)
      })
      group.rotation.y = Math.sin(t * 0.4) * 0.35
    },
  }
}

// InoAI: messages travel between a Discord bubble and a terminal running your CLI
function buildBridge(THREE) {
  const { scene, camera } = baseScene(THREE, 6.4)
  const group = new THREE.Group()
  group.scale.setScalar(0.68)
  scene.add(group)
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.62, 32, 16), mat(THREE, SIGNAL, { transparent: true, opacity: 0.9 }))
  bubble.scale.set(1.25, 0.9, 0.6)
  bubble.position.set(-1.7, 0.2, 0)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 12), mat(THREE, SIGNAL))
  tail.position.set(-2.15, -0.38, 0)
  tail.rotation.z = -0.6
  const terminal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.5), mat(THREE, 0x1d2026))
  terminal.position.set(1.7, 0.2, 0)
  terminal.add(
    new THREE.LineSegments(new THREE.EdgesGeometry(terminal.geometry), new THREE.LineBasicMaterial({ color: SIGNAL }))
  )
  const cursor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.02), mat(THREE, BONE, { emissive: BONE, emissiveIntensity: 0.8 }))
  cursor.position.set(-0.4, -0.25, 0.26)
  terminal.add(cursor)
  group.add(bubble, tail, terminal)
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-1.0, 0.4, 0),
    new THREE.Vector3(0, 1.4, 0.4),
    new THREE.Vector3(1.0, 0.4, 0)
  )
  const dots = Array.from({ length: 6 }, (_, i) => {
    const color = i % 2 ? AMBER : SIGNAL
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), mat(THREE, color, { emissive: color, emissiveIntensity: 0.7 }))
    group.add(dot)
    return dot
  })
  let flow = 0
  return {
    scene,
    camera,
    update(t, dt, active) {
      flow += dt * (active ? 0.8 : 0.3)
      dots.forEach((dot, i) => {
        // even dots carry messages out, odd ones carry replies back
        const u = (flow + i / dots.length) % 1
        dot.position.copy(curve.getPoint(i % 2 ? 1 - u : u))
        dot.visible = active || i < 4
      })
      cursor.visible = Math.floor(t * 2) % 2 === 0
      group.rotation.y = Math.sin(t * 0.5) * 0.3
    },
  }
}

// Sparkling: the tiny voxel robot, bobbing and blinking, its spark glowing
function buildRobot(THREE) {
  const { scene, camera } = baseScene(THREE, 6)
  const robot = new THREE.Group()
  scene.add(robot)
  const box = (w, h, d, color, x, y, z, extra) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(THREE, color, extra))
    m.position.set(x, y, z)
    robot.add(m)
    return m
  }
  box(1.1, 0.9, 0.9, SIGNAL, 0, 0.55, 0) // head
  const eyes = [box(0.18, 0.24, 0.05, BONE, -0.22, 0.6, 0.46), box(0.18, 0.24, 0.05, BONE, 0.22, 0.6, 0.46)]
  box(0.8, 0.7, 0.6, 0x16b8a6, 0, -0.35, 0) // body
  const arms = [box(0.18, 0.5, 0.18, 0x16b8a6, -0.55, -0.3, 0), box(0.18, 0.5, 0.18, 0x16b8a6, 0.55, -0.3, 0)]
  box(0.06, 0.32, 0.06, FOG, 0, 1.14, 0) // antenna
  const spark = box(0.2, 0.2, 0.2, AMBER, 0, 1.38, 0, { emissive: AMBER, emissiveIntensity: 0.8 })
  box(0.22, 0.2, 0.22, 0x0f8c7e, -0.2, -0.82, 0)
  box(0.22, 0.2, 0.22, 0x0f8c7e, 0.2, -0.82, 0)
  return {
    scene,
    camera,
    update(t, dt, active) {
      const hop = active ? Math.abs(Math.sin(t * 6)) * 0.35 : 0
      robot.position.y = Math.sin(t * 2) * 0.08 + hop
      robot.rotation.y = active ? t * 2.5 : Math.sin(t * 0.7) * 0.5
      const blink = t % 3.2 < 0.12 ? 0.1 : 1
      eyes.forEach((eye) => (eye.scale.y = blink))
      arms[0].rotation.z = active ? -0.6 + Math.sin(t * 10) * 0.5 : 0
      arms[1].rotation.z = active ? 0.6 - Math.sin(t * 10) * 0.5 : 0
      spark.material.emissiveIntensity = 0.5 + Math.sin(t * 4) * 0.4
      spark.rotation.set(t, t * 1.3, 0)
    },
  }
}

// AgentOS: the four ARMS levels as stacked plates around a shared core
function buildLayers(THREE) {
  const { scene, camera } = baseScene(THREE, 6.4)
  const group = new THREE.Group()
  scene.add(group)
  const colors = [BONE, SIGNAL, AMBER, 0x16b8a6] // Apps, Routines, Memory, Skills
  const plates = colors.map((color, i) => {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.25 - i * 0.12, 1.25 - i * 0.12, 0.12, 6), mat(THREE, color, { transparent: true, opacity: 0.85 }))
    plate.add(new THREE.LineSegments(new THREE.EdgesGeometry(plate.geometry), new THREE.LineBasicMaterial({ color: 0x15171b })))
    group.add(plate)
    return plate
  })
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 8), mat(THREE, FOG))
  group.add(core)
  const notes = Array.from({ length: 5 }, () => {
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat(THREE, AMBER, { emissive: AMBER, emissiveIntensity: 0.5 }))
    group.add(note)
    return note
  })
  let spread = 0.32
  return {
    scene,
    camera,
    update(t, dt, active) {
      spread += ((active ? 0.62 : 0.32) - spread) * Math.min(1, dt * 6)
      plates.forEach((plate, i) => {
        plate.position.y = (1.5 - i) * spread
        plate.rotation.y = t * (0.2 + i * 0.12) * (i % 2 ? -1 : 1)
      })
      // notes orbit the Memory plate
      notes.forEach((note, i) => {
        const a = t * 0.9 + (i / notes.length) * Math.PI * 2
        note.position.set(Math.cos(a) * 1.2, plates[2].position.y + 0.18, Math.sin(a) * 1.2)
        note.rotation.set(t, t, 0)
      })
      group.rotation.x = 0.15
    },
  }
}

// inoTives site: this site's own publishing history, one bar per day from the
// notes index; hovering sends a wave across it in publishing order
function buildSite(THREE) {
  const { scene, camera } = baseScene(THREE, 6.4)
  camera.position.set(0, 3.2, 5.6)
  camera.lookAt(0, 0, 0)
  const counts = {}
  getAllPosts().forEach((p) => p.date && (counts[p.date] = (counts[p.date] || 0) + 1))
  const dates = Object.keys(counts).sort()
  const days = []
  if (dates.length) {
    const start = parseDate(dates[0])
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    const end = parseDate(dates[dates.length - 1])
    for (let d = new Date(start), n = 0; d <= end; d.setDate(d.getDate() + 1), n++) {
      days.push({ week: Math.floor(n / 7), dow: n % 7, count: counts[toIsoDate(d)] || 0 })
    }
  }
  const weeks = days.length ? days[days.length - 1].week + 1 : 1
  const cell = 3.6 / weeks
  const geometry = new THREE.BoxGeometry(cell * 0.8, 1, cell * 0.8)
  geometry.translate(0, 0.5, 0)
  const mesh = new THREE.InstancedMesh(geometry, mat(THREE, 0xffffff), Math.max(days.length, 1))
  const group = new THREE.Group()
  group.add(mesh)
  scene.add(group)
  const slate = new THREE.Color(SLATE)
  const cyan = new THREE.Color(SIGNAL)
  const amber = new THREE.Color(AMBER)
  const colour = new THREE.Color()
  const dummy = new THREE.Object3D()
  let wave = -10
  return {
    scene,
    camera,
    update(t, dt, active) {
      // the wave keeps running until it has crossed the board
      if (active || (wave > -10 && wave < weeks + 4)) wave += dt * 14
      if (!active && wave >= weeks + 4) wave = -10
      days.forEach((day, n) => {
        const near = Math.max(0, 1 - Math.abs(day.week - wave) / 2.5)
        const height = 0.04 + day.count * 0.16 + near * 0.35
        dummy.position.set((day.week - (weeks - 1) / 2) * cell, 0, (day.dow - 3) * cell)
        dummy.scale.set(1, height, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(n, dummy.matrix)
        colour.copy(day.count ? cyan : slate).lerp(slate, day.count ? 0.45 - Math.min(day.count, 3) * 0.15 : 0)
        if (near > 0.5) colour.lerp(amber, near - 0.3)
        mesh.setColorAt(n, colour)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      group.rotation.y = Math.sin(t * 0.3) * 0.35
    },
  }
}

// AWS guide: a cloud with services orbiting it
function buildCloud(THREE) {
  const { scene, camera } = baseScene(THREE, 6.4)
  const group = new THREE.Group()
  scene.add(group)
  const puff = mat(THREE, BONE, { roughness: 0.8 })
  ;[
    [0, 0.2, 0, 0.85],
    [-0.85, -0.05, 0.1, 0.6],
    [0.85, -0.05, 0.1, 0.62],
    [-0.4, 0.55, -0.1, 0.55],
    [0.45, 0.6, -0.1, 0.5],
  ].forEach(([x, y, z, r]) => {
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), puff)
    sphere.position.set(x, y, z)
    group.add(sphere)
  })
  const services = [SIGNAL, AMBER, SIGNAL, 0x16b8a6].map((color, i) => {
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), mat(THREE, color))
    group.add(cube)
    return { cube, offset: (i / 4) * Math.PI * 2 }
  })
  let orbit = 0
  return {
    scene,
    camera,
    update(t, dt, active) {
      orbit += dt * (active ? 2.2 : 0.6)
      services.forEach(({ cube, offset }, i) => {
        const a = orbit + offset
        cube.position.set(Math.cos(a) * 1.75, Math.sin(a * 2) * 0.25 - 0.1, Math.sin(a) * 1.1)
        cube.rotation.set(t + i, t * 1.2, 0)
      })
      group.position.y = Math.sin(t * 0.8) * 0.08
      group.rotation.y = Math.sin(t * 0.3) * 0.3
    },
  }
}

// Claude certifications: four rising steps, one per exam, with a badge on top
function buildPath(THREE) {
  const { scene, camera } = baseScene(THREE, 6.6)
  const group = new THREE.Group()
  group.position.set(0.1, -0.6, 0)
  scene.add(group)
  const steps = [0.35, 0.7, 1.05, 1.4].map((height, i) => {
    const color = new THREE.Color(SLATE).lerp(new THREE.Color(SIGNAL), 0.35 + i * 0.2)
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.75, height, 0.9), mat(THREE, color))
    step.position.set(-1.2 + i * 0.8, height / 2, 0)
    group.add(step)
    return step
  })
  const badge = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 12, 32), mat(THREE, AMBER, { emissive: AMBER, emissiveIntensity: 0.4 }))
  group.add(badge)
  let climb = 0
  return {
    scene,
    camera,
    update(t, dt, active) {
      // on hover the badge climbs the steps exam by exam; at rest it sits on the top step
      climb = active ? (climb + dt * 0.9) % 4 : 0
      const top = steps[active ? Math.floor(climb) : 3]
      badge.position.set(top.position.x, top.geometry.parameters.height + 0.45 + Math.sin(t * 2) * 0.06, 0)
      badge.rotation.y = t * (active ? 3 : 1.2)
      group.rotation.y = -0.35 + Math.sin(t * 0.4) * 0.15
    },
  }
}

// AI Future Training: blocks assembling into a structure, learn by building
function buildBuild(THREE) {
  const { scene, camera } = baseScene(THREE, 6.4)
  const group = new THREE.Group()
  group.position.y = -0.7
  scene.add(group)
  const slots = []
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4 - y; x++) slots.push([(x - (3 - y) / 2) * 0.62, y * 0.5 + 0.25])
  const blocks = slots.map(([x, y], i) => {
    const color = i % 5 === 0 ? AMBER : i % 2 ? SIGNAL : 0x16b8a6
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.44, 0.56), mat(THREE, color))
    block.userData.target = new THREE.Vector3(x, y, 0)
    group.add(block)
    return block
  })
  let built = blocks.length
  return {
    scene,
    camera,
    update(t, dt, active) {
      // on hover the structure is taken down and rebuilt, one block at a time
      built = active ? (built + dt * 3.5) % (blocks.length + 3) : Math.min(blocks.length, built + dt * 6)
      blocks.forEach((block, i) => {
        const placed = i < built
        const target = block.userData.target
        const goal = placed ? target.y : target.y + 2.2
        block.position.x = target.x
        block.position.y += (goal - block.position.y) * Math.min(1, dt * 10)
        block.visible = placed || block.position.y < target.y + 2
        block.scale.setScalar(placed ? 1 : 0.6)
      })
      group.rotation.y = Math.sin(t * 0.35) * 0.4
    },
  }
}

const BUILDERS = { loop: buildLoop, dag: buildDag, bridge: buildBridge, robot: buildRobot, layers: buildLayers, site: buildSite, cloud: buildCloud, path: buildPath, build: buildBuild }

export default function ProjectEmblems() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    let disposed = false
    let cleanup = () => {}

    loadThree()
      .then((THREE) => {
        if (disposed) return
        const reduceMotion = prefersReducedMotion()
        let renderer
        try {
          renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
        } catch {
          return
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.setClearColor(0x000000, 0)

        const emblems = [...document.querySelectorAll('[data-emblem]')]
          .map((el) => {
            const build = BUILDERS[el.dataset.emblem]
            return build ? { el, card: el.closest('[data-project]'), ...build(THREE) } : null
          })
          .filter(Boolean)
        emblems.forEach(({ el }) => el.classList.add('is-drawn'))

        const resize = () => renderer.setSize(window.innerWidth, window.innerHeight, false)
        window.addEventListener('resize', resize)
        resize()

        let frame
        let last = performance.now()
        const tick = (now) => {
          const dt = Math.min(0.05, (now - last) / 1000)
          last = now
          const t = reduceMotion ? 1.2 : now / 1000
          const height = canvas.clientHeight

          renderer.setScissorTest(false)
          renderer.clear()
          renderer.setScissorTest(true)
          emblems.forEach((emblem) => {
            const rect = emblem.el.getBoundingClientRect()
            if (rect.bottom < 0 || rect.top > height || rect.width === 0) return
            const active = !reduceMotion && emblem.card?.matches(':hover, :focus-within')
            emblem.update(t, reduceMotion ? 0 : dt, active)
            const bottom = height - rect.bottom
            renderer.setViewport(rect.left, bottom, rect.width, rect.height)
            renderer.setScissor(rect.left, bottom, rect.width, rect.height)
            emblem.camera.aspect = rect.width / rect.height
            emblem.camera.updateProjectionMatrix()
            renderer.render(emblem.scene, emblem.camera)
          })
          frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)

        cleanup = () => {
          cancelAnimationFrame(frame)
          window.removeEventListener('resize', resize)
          emblems.forEach(({ el, scene }) => {
            el.classList.remove('is-drawn')
            scene.traverse((obj) => {
              obj.geometry?.dispose()
              obj.material?.dispose()
            })
          })
          renderer.dispose()
        }
      })
      .catch(() => {})

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  return <canvas ref={canvasRef} className="project-emblems-canvas" aria-hidden="true" />
}
