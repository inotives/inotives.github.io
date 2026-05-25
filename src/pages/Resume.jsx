import { usePage } from '../hooks/useMarkdown'
import MarkdownRenderer from '../components/MarkdownRenderer'

export default function Resume() {
  const { page, loading } = usePage('resume')

  if (loading) return <p className="empty-state">Loading...</p>
  if (!page) return <p className="empty-state">Page not found.</p>

  const handleExportPdf = () => {
    const previousTitle = document.title
    document.title = 'Toni-Lim-Resume'

    const restoreTitle = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }

    window.addEventListener('afterprint', restoreTitle)
    window.print()
  }

  return (
    <div className="resume-page">
      <div className="resume-actions">
        <div
          className="resume-export-control"
          data-tooltip="Turn off browser headers and footers in the print dialog for a clean PDF."
        >
          <button
            type="button"
            className="button-link"
            onClick={handleExportPdf}
          >
            Export PDF
          </button>
        </div>
      </div>
      <MarkdownRenderer content={page.content} />
    </div>
  )
}
