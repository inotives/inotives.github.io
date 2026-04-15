import { usePage } from '../hooks/useMarkdown'
import MarkdownRenderer from '../components/MarkdownRenderer'

export default function Portfolio() {
  const { page, loading } = usePage('portfolio')

  if (loading) return <p className="text-gray-400">Loading...</p>
  if (!page) return <p className="text-gray-400">Page not found.</p>

  return <MarkdownRenderer content={page.content} />
}
