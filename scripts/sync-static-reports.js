import fs from 'fs'
import path from 'path'

const GENERATED_REPORTS_DIR = path.resolve('docs/reports')
const PUBLIC_REPORTS_DIR = path.resolve('public/reports')

if (fs.existsSync(GENERATED_REPORTS_DIR)) {
  fs.mkdirSync(PUBLIC_REPORTS_DIR, { recursive: true })
  fs.cpSync(GENERATED_REPORTS_DIR, PUBLIC_REPORTS_DIR, {
    recursive: true,
    force: true,
  })
  console.log(`Static reports synced: ${GENERATED_REPORTS_DIR} → ${PUBLIC_REPORTS_DIR}`)
} else {
  console.log('Static reports sync skipped: docs/reports does not exist')
}
