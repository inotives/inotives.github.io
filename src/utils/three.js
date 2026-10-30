// three.js is loaded from the CDN at runtime so it only downloads on pages
// that draw a 3D scene; the promise is shared so it loads once per visit
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js'

let threePromise = null

export function loadThree() {
  threePromise ||= import(/* @vite-ignore */ THREE_URL).catch((error) => {
    threePromise = null
    throw error
  })
  return threePromise
}

// Distance along `viewDir` (looking at the origin) at which every corner of
// `box` (or every point in an array) projects inside `margin` of the frame.
// Iterates because perspective makes the projected size non-linear in distance.
export function fitDistance(THREE, camera, box, viewDir, margin = 0.88) {
  const corners = Array.isArray(box) ? box : []
  if (!Array.isArray(box)) {
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z))
  }

  let distance = 12
  const projected = new THREE.Vector3()
  for (let k = 0; k < 4; k++) {
    camera.position.copy(viewDir).multiplyScalar(distance)
    camera.lookAt(0, 0, 0)
    camera.updateMatrixWorld()
    const extent = Math.max(
      ...corners.map((c) => {
        projected.copy(c).project(camera)
        return Math.max(Math.abs(projected.x), Math.abs(projected.y))
      })
    )
    distance *= extent / margin
  }
  return distance
}

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
