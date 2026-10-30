import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fitDistance, loadThree, prefersReducedMotion } from '../utils/three'

// Each series is a chain of blocks: one block per note, linked in reading
// order from the first block to the newest at the tip. Long chains snake
// back and forth in rows that recede away from the viewer.
const BLOCK = 0.42
const SPACING = 0.95
const ROW_GAP = 1.1
const STACK_GAP = 1.4
const LIFT = 0.28
// Alone, a series snakes in short rows; on the overview each series is a
// long strip, one behind the other, so the scene fits a wide frame
const PER_ROW_ALONE = 6
const PER_ROW_OVERVIEW = 24

const SIGNAL = 0x1fefd7
const AMBER = 0xf6c453
const BONE = 0xe4e1d8
const RAISE = 0x1d2026
const LINK = 0x3a404a

// Grid position of block i in a back-and-forth (boustrophedon) layout
function chainSlot(i, perRow) {
  const row = Math.floor(i / perRow)
  const col = row % 2 === 0 ? i % perRow : perRow - 1 - (i % perRow)
  return { x: col * SPACING, z: -row * ROW_GAP }
}

export default function SeriesModel({ stacks, highlightSlug, onHoverSlug, className = '' }) {
  const containerRef = useRef(null)
  const highlightRef = useRef(highlightSlug)
  const hoverCallbackRef = useRef(onHoverSlug)
  const navigate = useNavigate()
  const [tooltip, setTooltip] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    highlightRef.current = highlightSlug
    hoverCallbackRef.current = onHoverSlug
  }, [highlightSlug, onHoverSlug])

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

        const scene = new THREE.Scene()
        scene.add(new THREE.AmbientLight(0xffffff, 0.6))
        const sun = new THREE.DirectionalLight(0xffffff, 1.4)
        sun.position.set(-3, 6, 4)
        scene.add(sun)

        const world = new THREE.Group()
        scene.add(world)

        const blockGeometry = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK)
        const edgeGeometry = new THREE.EdgesGeometry(blockGeometry)
        const linkMaterial = new THREE.MeshStandardMaterial({ color: LINK, roughness: 0.6, metalness: 0.4 })
        const linkGeometries = []
        const disposables = [blockGeometry, edgeGeometry, linkMaterial]

        const perRow = stacks.length === 1 ? PER_ROW_ALONE : PER_ROW_OVERVIEW
        const blocks = []
        let offsetZ = 0
        stacks.forEach((stack) => {
          const count = stack.posts.length
          const rows = Math.max(1, Math.ceil(count / perRow))
          stack.posts.forEach((post, i) => {
            const slot = chainSlot(i, perRow)
            const x = slot.x
            const z = slot.z + offsetZ
            const isTip = i === count - 1
            // newer blocks glow brighter; the tip is amber
            const glow = count > 1 ? i / (count - 1) : 1
            const edgeColor = new THREE.Color(isTip ? AMBER : SIGNAL).lerp(new THREE.Color(RAISE), isTip ? 0 : 0.55 * (1 - glow))
            const fillColor = new THREE.Color(RAISE).lerp(new THREE.Color(isTip ? AMBER : SIGNAL), isTip ? 0.55 : 0.12 + glow * 0.18)

            const material = new THREE.MeshStandardMaterial({
              color: fillColor,
              emissive: isTip ? AMBER : SIGNAL,
              emissiveIntensity: 0,
              roughness: 0.35,
              metalness: 0.2,
              transparent: true,
              opacity: 0.92,
            })
            const edgeMaterial = new THREE.LineBasicMaterial({ color: edgeColor })
            disposables.push(material, edgeMaterial)

            const mesh = new THREE.Mesh(blockGeometry, material)
            mesh.add(new THREE.LineSegments(edgeGeometry, edgeMaterial))
            mesh.position.set(x, BLOCK / 2, z)
            mesh.userData.index = blocks.length
            world.add(mesh)
            blocks.push({ mesh, material, edgeMaterial, edgeColor, fillColor, stack, i, count, post, lift: 0 })
          })

          // Links between consecutive blocks
          for (let i = 1; i < count; i++) {
            const a = chainSlot(i - 1, perRow)
            const b = chainSlot(i, perRow)
            const from = new THREE.Vector3(a.x, BLOCK / 2, a.z + offsetZ)
            const to = new THREE.Vector3(b.x, BLOCK / 2, b.z + offsetZ)
            const length = from.distanceTo(to) - BLOCK
            const geometry = new THREE.CylinderGeometry(0.035, 0.035, length, 8)
            linkGeometries.push(geometry)
            const link = new THREE.Mesh(geometry, linkMaterial)
            link.position.copy(from).add(to).multiplyScalar(0.5)
            link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize())
            world.add(link)
          }
          // next series sits behind this one
          offsetZ -= rows * ROW_GAP + STACK_GAP
        })

        // Centre the whole layout on the origin
        const bounds = new THREE.Box3().setFromObject(world)
        const centre = bounds.getCenter(new THREE.Vector3())
        world.position.sub(centre)
        bounds.translate(centre.clone().negate())
        bounds.max.y += LIFT

        const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200)
        // a lower, flatter view on the overview keeps its wide strips large
        const viewDir = (stacks.length === 1 ? new THREE.Vector3(0.35, 0.9, 1) : new THREE.Vector3(0.12, 0.62, 1)).normalize()

        const resize = () => {
          const { clientWidth: w, clientHeight: h } = container
          if (!w || !h) return
          renderer.setSize(w, h, false)
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          camera.userData.distance = fitDistance(THREE, camera, bounds, viewDir)
        }
        const observer = new ResizeObserver(resize)
        observer.observe(container)
        resize()

        const raycaster = new THREE.Raycaster()
        const pointer = new THREE.Vector2()
        const sway = { x: 0, y: 0 }
        let hoverIndex = -1

        const onMove = (e) => {
          const rect = renderer.domElement.getBoundingClientRect()
          pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
          pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
          raycaster.setFromCamera(pointer, camera)
          const hit = raycaster.intersectObjects(blocks.map((b) => b.mesh), false)[0]
          const next = hit ? hit.object.userData.index : -1
          if (next !== hoverIndex) {
            hoverIndex = next
            const block = blocks[next]
            renderer.domElement.style.cursor = block ? 'pointer' : ''
            hoverCallbackRef.current?.(block ? block.post.slug : null)
            setTooltip(
              block
                ? {
                    title: block.post.title,
                    meta: `${stacks.length > 1 ? `${block.stack.label}, block` : 'Block'} ${block.i + 1} of ${block.count}`,
                  }
                : null
            )
          }
          if (hoverIndex >= 0) {
            setTooltip((t) => t && { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top })
          }
        }
        const onLeave = () => {
          hoverIndex = -1
          renderer.domElement.style.cursor = ''
          hoverCallbackRef.current?.(null)
          setTooltip(null)
        }
        const onClick = () => {
          const block = blocks[hoverIndex]
          if (block) navigate(`/notes/${block.post.slug}`)
        }
        const onPointer = (e) => {
          sway.x = (e.clientX / window.innerWidth) * 2 - 1
          sway.y = (e.clientY / window.innerHeight) * 2 - 1
        }
        renderer.domElement.addEventListener('pointermove', onMove)
        renderer.domElement.addEventListener('pointerleave', onLeave)
        renderer.domElement.addEventListener('click', onClick)
        window.addEventListener('pointermove', onPointer)

        const bone = new THREE.Color(BONE)
        const longest = Math.max(...stacks.map((s) => s.posts.length), 1)
        const camPos = new THREE.Vector3()
        let frame
        const tick = (time) => {
          const t = time * 0.001
          // a pulse runs from the first block to the tip, like a new block propagating
          const pulse = reduceMotion ? -10 : ((t * 9) % (longest + 14)) - 2

          blocks.forEach((block, n) => {
            const lit = n === hoverIndex || block.post.slug === highlightRef.current
            const targetLift = lit ? LIFT : 0
            block.lift += (targetLift - block.lift) * (reduceMotion ? 1 : 0.18)
            block.mesh.position.y = BLOCK / 2 + block.lift
            block.edgeMaterial.color.copy(lit ? bone : block.edgeColor)
            block.material.color.copy(block.fillColor)
            if (lit) block.material.color.lerp(bone, 0.35)
            const near = Math.max(0, 1 - Math.abs(block.i - pulse) / 1.6)
            block.material.emissiveIntensity = near * 0.55
          })

          const angle = reduceMotion ? 0 : sway.x * 0.25
          const distance = camera.userData.distance || 10
          camPos.copy(viewDir).applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).multiplyScalar(distance)
          camPos.y += reduceMotion ? 0 : -sway.y * 0.6
          camera.position.copy(camPos)
          camera.lookAt(0, 0, 0)

          renderer.render(scene, camera)
          frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)

        cleanup = () => {
          cancelAnimationFrame(frame)
          observer.disconnect()
          renderer.domElement.removeEventListener('pointermove', onMove)
          renderer.domElement.removeEventListener('pointerleave', onLeave)
          renderer.domElement.removeEventListener('click', onClick)
          window.removeEventListener('pointermove', onPointer)
          disposables.forEach((d) => d.dispose())
          linkGeometries.forEach((g) => g.dispose())
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
  }, [stacks, navigate])

  if (failed) return null

  return (
    <div className={`series-model ${className}`}>
      <div ref={containerRef} className="series-model-canvas" aria-hidden="true" />
      {tooltip && tooltip.x != null && (
        <div className="scene-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <b>{tooltip.title}</b>
          <span>{tooltip.meta}</span>
        </div>
      )}
      <p className="series-model-hint">
        Each block is a note, chained in reading order to the newest at the tip. Hover to read, click to open.
      </p>
    </div>
  )
}
