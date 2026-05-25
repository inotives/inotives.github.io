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

export default function MarkdownRenderer({ content }) {
  if (!content) return null

  const headingComponents = {
    h2: ({ children, ...props }) => {
      const id = slugifyHeading(getTextFromNode(children))
      return (
        <h2 id={id} {...props}>
          {children}
        </h2>
      )
    },
    h3: ({ children, ...props }) => {
      const id = slugifyHeading(getTextFromNode(children))
      return (
        <h3 id={id} {...props}>
          {children}
        </h3>
      )
    },
  }

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
