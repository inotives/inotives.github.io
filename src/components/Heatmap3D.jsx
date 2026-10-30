import { useEffect, useRef, useState } from 'react'
import { formatLong } from '../utils/dates'
import { fitDistance, loadThree, prefersReducedMotion } from '../utils/three'

// The publishing heatmap as a 3D board: weeks run left to right, weekdays
// front to back (Monday at the back), and each day's bar rises with its notes
const CELL = 0.26
const BAR = 0.2
const BASE = 0.03
const PER_NOTE = 0.13

const SIGNAL = 0x1fefd7
const AMBER = 0xf6c453
const BONE = 0xe4e1d8
const RAISE = 0x262a31
const FOG = '#8b9099'

function monthLabel(THREE, text) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 48
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = FOG
  ctx.font = '500 30px "IBM Plex Sans Condensed", "Arial Narrow", sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 4, 24)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  sprite.scale.set(0.8, 0.3, 1)
  return sprite
}

export default function Heatmap3D({ cells, months, selectedDay, onSelect, onFail }) {
  const containerRef = useRef(null)
  const selectedRef = useRef(selectedDay)
  const selectRef = useRef(onSelect)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    selectedRef.current = selectedDay
    selectRef.current = onSelect
  }, [selectedDay, onSelect])

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
          onFail()
          return
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        container.appendChild(renderer.domElement)

        const scene = new THREE.Scene()
        scene.add(new THREE.AmbientLight(0xffffff, 0.65))
        const sun = new THREE.DirectionalLight(0xffffff, 1.5)
        sun.position.set(-4, 8, 6)
        scene.add(sun)

        // Every slot is drawn; days to come and padding outside the year are faint tiles
        const days = cells
        const weeks = Math.ceil(cells.length / 7)
        // a full year is long and thin, so bars grow with its width to keep their presence
        const perNote = PER_NOTE * Math.max(1, weeks / 30)
        const blankColor = new THREE.Color(RAISE).lerp(new THREE.Color(0x15171b), 0.6)
        const offsetX = ((weeks - 1) * CELL) / 2
        const offsetZ = (6 * CELL) / 2

        // Unit-height bars, scaled per day; the box sits on y = 0
        const geometry = new THREE.BoxGeometry(BAR, 1, BAR)
        geometry.translate(0, 0.5, 0)
        const material = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.15 })
        const mesh = new THREE.InstancedMesh(geometry, material, days.length)
        scene.add(mesh)

        const levelColor = [
          new THREE.Color(RAISE),
          new THREE.Color(RAISE).lerp(new THREE.Color(SIGNAL), 0.4),
          new THREE.Color(RAISE).lerp(new THREE.Color(SIGNAL), 0.7),
          new THREE.Color(SIGNAL),
        ]
        const bars = days.map((cell) => {
          const index = cells.indexOf(cell)
          return {
            cell,
            x: Math.floor(index / 7) * CELL - offsetX,
            z: (index % 7) * CELL - offsetZ,
            height: cell.future ? BASE * 0.5 : BASE + cell.count * perNote,
            color: cell.future ? blankColor : levelColor[Math.min(cell.count, 3)],
          }
        })

        months.forEach(({ week, label }) => {
          const sprite = monthLabel(THREE, label)
          sprite.position.set(week * CELL - offsetX + 0.3, 0.02, 7 * CELL - offsetZ + 0.1)
          scene.add(sprite)
        })

        // Frame the board's corners (with the month row) and each bar's top,
        // not a box as tall as the tallest bar everywhere
        const fitPoints = [
          new THREE.Vector3(-offsetX - CELL, 0, -offsetZ - CELL),
          new THREE.Vector3(offsetX + CELL, 0, -offsetZ - CELL),
          new THREE.Vector3(-offsetX - CELL, 0, offsetZ + 2 * CELL),
          new THREE.Vector3(offsetX + CELL, 0, offsetZ + 2 * CELL),
          ...bars.filter((b) => b.cell.count).map((b) => new THREE.Vector3(b.x, b.height, b.z)),
        ]
        const centre = new THREE.Box3().setFromPoints(fitPoints).getCenter(new THREE.Vector3())
        scene.position.sub(centre)
        fitPoints.forEach((p) => p.sub(centre))

        const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 400)
        const viewDir = new THREE.Vector3(-0.1, 0.42, 1).normalize()

        const resize = () => {
          const { clientWidth: w, clientHeight: h } = container
          if (!w || !h) return
          renderer.setSize(w, h, false)
          camera.aspect = w / h
          camera.updateProjectionMatrix()
          camera.userData.distance = fitDistance(THREE, camera, fitPoints, viewDir, 0.92)
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
          const hit = raycaster.intersectObject(mesh)[0]
          const next = hit && !bars[hit.instanceId].cell.future ? hit.instanceId : -1
          if (next !== hoverIndex) {
            hoverIndex = next
            const bar = bars[next]
            renderer.domElement.style.cursor = bar?.cell.count ? 'pointer' : ''
            setTooltip(
              bar
                ? {
                    title: formatLong(bar.cell.iso),
                    meta: bar.cell.count ? `${bar.cell.count} ${bar.cell.count === 1 ? 'note' : 'notes'}` : 'No notes',
                  }
                : null
            )
          }
          if (hoverIndex >= 0) setTooltip((t) => t && { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top })
        }
        const onLeave = () => {
          hoverIndex = -1
          renderer.domElement.style.cursor = ''
          setTooltip(null)
        }
        const onClick = () => {
          const bar = bars[hoverIndex]
          if (bar?.cell.count) selectRef.current(bar.cell.iso)
        }
        const onPointer = (e) => {
          sway.x = (e.clientX / window.innerWidth) * 2 - 1
          sway.y = (e.clientY / window.innerHeight) * 2 - 1
        }
        renderer.domElement.addEventListener('pointermove', onMove)
        renderer.domElement.addEventListener('pointerleave', onLeave)
        renderer.domElement.addEventListener('click', onClick)
        window.addEventListener('pointermove', onPointer)

        const dummy = new THREE.Object3D()
        const colour = new THREE.Color()
        const bone = new THREE.Color(BONE)
        const amber = new THREE.Color(AMBER)
        const up = new THREE.Vector3(0, 1, 0)
        let start = null
        let frame

        const tick = (time) => {
          start ??= time
          // one entrance: bars grow from the board, sweeping left to right
          const elapsed = reduceMotion ? Infinity : (time - start) / 1000
          bars.forEach((bar, n) => {
            const delay = (bar.x + offsetX) * 0.12
            const t = Math.min(1, Math.max(0, (elapsed - delay) / 0.6))
            const grow = 1 - (1 - t) ** 3
            dummy.position.set(bar.x, 0, bar.z)
            dummy.scale.set(1, Math.max(0.001, BASE + (bar.height - BASE) * grow), 1)
            dummy.updateMatrix()
            mesh.setMatrixAt(n, dummy.matrix)

            const selected = bar.cell.iso === selectedRef.current
            colour.copy(selected ? amber : n === hoverIndex && bar.cell.count ? bone : bar.color)
            mesh.setColorAt(n, colour)
          })
          mesh.instanceMatrix.needsUpdate = true
          mesh.instanceColor.needsUpdate = true
          mesh.computeBoundingSphere()

          const distance = camera.userData.distance || 10
          camera.position
            .copy(viewDir)
            .applyAxisAngle(up, reduceMotion ? 0 : sway.x * 0.12)
            .multiplyScalar(distance)
          camera.position.y += reduceMotion ? 0 : -sway.y * 0.25
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
          scene.traverse((obj) => {
            if (obj.isSprite) {
              obj.material.map.dispose()
              obj.material.dispose()
            }
          })
          geometry.dispose()
          material.dispose()
          renderer.dispose()
          renderer.domElement.remove()
        }
      })
      .catch(() => {
        if (!disposed) onFail()
      })

    return () => {
      disposed = true
      cleanup()
    }
  }, [cells, months, onFail])

  return (
    <div className="heatmap-3d">
      <div ref={containerRef} className="heatmap-3d-canvas" aria-hidden="true" />
      {tooltip && tooltip.x != null && (
        <div className="scene-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <b>{tooltip.title}</b>
          <span>{tooltip.meta}</span>
        </div>
      )}
    </div>
  )
}
