import fs from 'node:fs'
import path from 'node:path'

const outDir = path.resolve('docs')
const indexPath = path.join(outDir, 'index.html')
const fallbackPath = path.join(outDir, '404.html')

fs.copyFileSync(indexPath, fallbackPath)
console.log(`SPA fallback generated: ${fallbackPath}`)

