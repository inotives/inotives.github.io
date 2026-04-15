import { usePage } from '../hooks/useMarkdown'
import MarkdownRenderer from '../components/MarkdownRenderer'

export default function About() {
  const { page, loading } = usePage('about')

  if (loading) return <p className="text-gray-400">Loading...</p>
  if (!page) return <p className="text-gray-400">Page not found.</p>

  return <MarkdownRenderer content={page.content} />
}
