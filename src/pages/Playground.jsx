import { PLAYGROUND_LIBRARIES, PLAYGROUND_MOCKS } from '../data/playground'
import { formatShort } from '../utils/dates'

const libraryName = Object.fromEntries(PLAYGROUND_LIBRARIES.map((lib) => [lib.id, lib.name]))

function MockCard({ mock }) {
  const title = `${mock.project}: ${mock.name}`
  return (
    <article className="mock-card">
      {/* mocks are standalone HTML files, so these are plain links, not router links */}
      <a href={mock.href} className="mock-preview" tabIndex={-1} aria-hidden="true">
        <img src={mock.preview} alt="" loading="lazy" width="1200" height="601" />
      </a>
      <div className="mock-body">
        <div className="record-meta">
          <span>{formatShort(mock.date)}</span>
          <span>Mock data</span>
        </div>
        <h3 className="record-title">
          <a href={mock.href}>{title}</a>
        </h3>
        <p className="record-copy">{mock.description}</p>
        {mock.credit && (
          <p className="mock-credit">
            Design inspired by{' '}
            <a href={mock.credit.href} target="_blank" rel="noopener noreferrer">
              {mock.credit.name}
            </a>
          </p>
        )}
        <div className="tag-row">
          {mock.libraries.map((id) => (
            <span key={id} className="tag">
              {libraryName[id]}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

export default function Playground() {
  return (
    <div className="page-stack">
      <header>
        <h1 className="page-title">Playground</h1>
        <p className="section-copy">
          UI experiments with 3D and new frontend libraries. Each mock is a single HTML file
          running on mock data; open one to try it full screen.
        </p>
      </header>

      <section>
        <div className="section-head">
          <h2 className="section-title">Mocks</h2>
          <span className="notes-count">{PLAYGROUND_MOCKS.length} mocks</span>
        </div>
        <div className="mock-grid">
          {PLAYGROUND_MOCKS.map((mock) => (
            <MockCard key={mock.id} mock={mock} />
          ))}
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2 className="section-title">Libraries</h2>
          <span className="notes-count">What the mocks are built with, and what I&apos;m trying next</span>
        </div>
        <ul className="library-list">
          {PLAYGROUND_LIBRARIES.map((lib) => {
            const usedIn = PLAYGROUND_MOCKS.filter((mock) => mock.libraries.includes(lib.id))
            return (
              <li key={lib.id}>
                <div className="library-head">
                  <h3>{lib.name}</h3>
                  <span>{lib.kind}</span>
                </div>
                <p>{lib.description}</p>
                <p className="library-used">
                  {usedIn.length > 0
                    ? `Used in ${usedIn.map((mock) => mock.name.toLowerCase()).join(', ')}`
                    : 'Not in a mock yet'}
                </p>
                <div className="library-links">
                  {lib.site && (
                    <a href={lib.site} className="text-link" target="_blank" rel="noopener noreferrer">
                      Website
                    </a>
                  )}
                  <a
                    href={`https://github.com/${lib.repo}`}
                    className="text-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GitHub
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
