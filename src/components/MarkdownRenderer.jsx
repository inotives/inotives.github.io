import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

function getTextFromNode(node) {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(getTextFromNode).join('')
  if (node && typeof node === 'object' && node.props?.children) {
    return getTextFromNode(node.props.children)
  }
  return ''
}

function slugifyHeading(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`"'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Defined once at module level: components created inside the render would be
// new types every render, so React would remount every heading and anything
// holding the old elements (the table-of-contents observer) would lose them
const headingComponents = {
  h2: ({ children, ...props }) => (
    <h2 id={slugifyHeading(getTextFromNode(children))} {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 id={slugifyHeading(getTextFromNode(children))} {...props}>
      {children}
    </h3>
  ),
}

export default function MarkdownRenderer({ content }) {
  if (!content) return null

  return (
    <div className="manual-prose">
      <ReactMarkdown
        components={headingComponents}
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
