import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

const CONTENT_DIR = path.resolve('content')
const OUTPUT_FILE = path.resolve('src/generated/content-index.json')

function scanMarkdownDir(dir, category) {
  const fullPath = path.join(CONTENT_DIR, dir)
  if (!fs.existsSync(fullPath)) return []

  return fs
    .readdirSync(fullPath)
    .filter((f) => f.endsWith('.md') && !f.startsWith('.'))
    .map((filename) => {
      const filePath = path.join(fullPath, filename)
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { data } = matter(raw)
      const slug = data.slug || filename.replace(/\.md$/, '')

      return {
        slug,
        filename,
        category,
        title: data.title || slug,
        date: data.date
          ? data.date instanceof Date
            ? data.date.toISOString().slice(0, 10)
            : String(data.date).slice(0, 10)
          : null,
        tags: data.tags || [],
        summary: data.summary || '',
        featured_image: data.featured_image || null,
        draft: data.draft || false,
      }
    })
    .filter((entry) => !entry.draft)
}

const posts = scanMarkdownDir('posts', 'post').sort(
  (a, b) => (b.date || '').localeCompare(a.date || '')
)

const pages = scanMarkdownDir('pages', 'page')

const index = { posts, pages }

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(index, null, 2))

console.log(
  `Content index generated: ${posts.length} posts, ${pages.length} pages → ${OUTPUT_FILE}`
)
