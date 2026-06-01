import contentIndex from '../generated/content-index.json'

// Import all markdown files at build time
const postFiles = import.meta.glob('/content/posts/*.md', {
  query: '?raw',
  import: 'default',
})
const pageFiles = import.meta.glob('/content/pages/*.md', {
  query: '?raw',
  import: 'default',
})

// Lightweight frontmatter stripper for the browser
// Full parsing happens at build time in generate-content-index.js
function stripFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return raw
  // Strip leading h1 that duplicates the frontmatter title
  return match[2].replace(/^\s*#\s+.+\r?\n+/, '')
}

export function getAllPosts() {
  return contentIndex.posts
}

export function getAllPages() {
  return contentIndex.pages
}

export function getAdhocResearchReports() {
  return contentIndex.reports?.adhocResearch || []
}

export function getStockPreOpenReports() {
  return contentIndex.reports?.stockPreOpen || []
}

export function getStockWeeklyReports() {
  return contentIndex.reports?.stockWeekly || []
}

export function getPostMeta(slug) {
  return contentIndex.posts.find((p) => p.slug === slug) || null
}

export async function getPostBySlug(slug) {
  const meta = getPostMeta(slug)
  if (!meta) return null

  const key = `/content/posts/${meta.filename}`
  const loader = postFiles[key]
  if (!loader) return null

  const raw = await loader()
  return { ...meta, content: stripFrontmatter(raw) }
}

export async function getPage(name) {
  const key = `/content/pages/${name}.md`
  const loader = pageFiles[key]
  if (!loader) return null

  const raw = await loader()
  const pageMeta = contentIndex.pages.find((p) => p.slug === name) || {}
  return { ...pageMeta, content: stripFrontmatter(raw) }
}
