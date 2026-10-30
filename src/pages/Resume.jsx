import { useEffect, useMemo, useRef, useState } from 'react'
import { usePage } from '../hooks/useMarkdown'
import MarkdownRenderer from '../components/MarkdownRenderer'
import ResumeTimeline from '../components/ResumeTimeline'
import { METRIC_PATTERN, parseResume, roleUsesSkill, skillPattern } from '../utils/resume'

// Sections that get custom rendering instead of plain markdown
const isInfo = (title) => /personal information/i.test(title)
const isExperience = (title) => /experience/i.test(title)
const isAchievements = (title) => /achievement/i.test(title)

// Marks every match of `pattern` inside `root` with the CSS Custom Highlight API,
// which styles text without touching the React-rendered DOM
function highlightText(name, root, pattern) {
  if (!('highlights' in CSS) || typeof Highlight === 'undefined') return
  CSS.highlights.delete(name)
  if (!root || !pattern) return
  const ranges = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(node.data)) !== null) {
      const range = new Range()
      range.setStart(node, match.index)
      range.setEnd(node, match.index + match[0].length)
      ranges.push(range)
    }
  }
  if (ranges.length) CSS.highlights.set(name, new Highlight(...ranges))
}

export default function Resume() {
  const { page, loading } = usePage('resume')
  const [skill, setSkill] = useState(null)
  const [selectedRole, setSelectedRole] = useState(null)
  const experienceRef = useRef(null)
  const achievementsRef = useRef(null)

  const resume = useMemo(() => (page ? parseResume(page.content) : null), [page])
  const pattern = useMemo(() => (skill ? skillPattern(skill) : null), [skill])

  const matchesRole = (role) => !pattern || roleUsesSkill(pattern, role)

  // How many roles mention each skill; skills no role mentions get no chip
  const skillCounts = useMemo(() => {
    const counts = {}
    if (!resume) return counts
    const roles = resume.companies.flatMap((c) => c.roles)
    resume.skillGroups.forEach(({ skills }) =>
      skills.forEach((s) => {
        const p = skillPattern(s)
        counts[s] = roles.filter((r) => roleUsesSkill(p, r)).length
      })
    )
    return counts
  }, [resume])

  useEffect(() => {
    highlightText('resume-skill', experienceRef.current, pattern)
  }, [pattern, resume])

  useEffect(() => {
    highlightText('resume-metric', achievementsRef.current, METRIC_PATTERN)
    return () => {
      if ('highlights' in CSS) {
        CSS.highlights.delete('resume-metric')
        CSS.highlights.delete('resume-skill')
      }
    }
  }, [resume])

  function selectRole(id) {
    setSelectedRole(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleExportPdf() {
    const previousTitle = document.title
    document.title = 'Toni-Lim-Resume'

    const restoreTitle = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }

    window.addEventListener('afterprint', restoreTitle)
    window.print()
  }

  if (loading) return null
  if (!resume) {
    return <p className="empty-state">The resume is missing. Check content/pages/resume.md.</p>
  }

  const info = resume.sections.find((s) => isInfo(s.title))
  const navSections = resume.sections.filter((s) => !isInfo(s.title))
  const matchingRoles = resume.companies.flatMap((c) => c.roles).filter(matchesRole).length

  return (
    <div className="resume-page">
      <header className="resume-header">
        <div>
          <h1 className="page-title">{resume.name || 'Resume'}</h1>
          {resume.tagline && <p className="resume-tagline">{resume.tagline}</p>}
        </div>
        {info && (
          <div className="resume-contact">
            {/* the name is already the page title, so its line is left out here */}
            <MarkdownRenderer
              content={info.body
                .split('\n')
                .filter((line) => !/full name/i.test(line))
                .join('\n')}
            />
          </div>
        )}
        <div className="resume-actions">
          <div
            className="resume-export-control"
            data-tooltip="Turn off browser headers and footers in the print dialog for a clean PDF."
          >
            <button type="button" className="button-primary" onClick={handleExportPdf}>
              Export PDF
            </button>
          </div>
        </div>
      </header>

      <ResumeTimeline companies={resume.companies} matchesRole={matchesRole} onSelect={selectRole} />

      <div className="resume-layout">
        <aside className="resume-rail">
          <nav aria-label="Resume sections">
            <h2>Sections</h2>
            {navSections.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.title}
              </a>
            ))}
          </nav>

          <section className="resume-filter" aria-label="Filter experience by skill">
            <h2>Where did I use…</h2>
            <p>
              {skill
                ? `${skill}: ${matchingRoles} ${matchingRoles === 1 ? 'role' : 'roles'}`
                : 'Pick a skill to highlight it across my experience.'}
            </p>
            {skill && (
              <button type="button" className="text-link resume-filter-clear" onClick={() => setSkill(null)}>
                Clear skill
              </button>
            )}
            {resume.skillGroups
              .filter((g) => g.skills.some((s) => skillCounts[s] > 0))
              .map((group) => (
                <div key={group.title} className="resume-filter-group">
                  <h3>{group.title}</h3>
                  <div className="tag-row">
                    {group.skills
                      .filter((s) => skillCounts[s] > 0)
                      .map((s) => (
                        <button
                          key={s}
                          type="button"
                          className={`tag ${skill === s ? 'tag-active' : ''}`}
                          aria-pressed={skill === s}
                          onClick={() => setSkill(skill === s ? null : s)}
                        >
                          {s}
                          <small>{skillCounts[s]}</small>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
          </section>
        </aside>

        <div className="resume-main">
          {navSections.map((section) => {
            if (isExperience(section.title)) {
              return (
                <section key={section.id} id={section.id} className="resume-section" ref={experienceRef}>
                  <h2 className="resume-section-title">{section.title}</h2>
                  {resume.companies.map((company) => (
                    <div key={company.name} className="resume-company">
                      <h3>{company.name}</h3>
                      {company.roles.map((role) => (
                        <article
                          key={role.id}
                          id={role.id}
                          className={[
                            'resume-role',
                            !matchesRole(role) && 'is-dim',
                            selectedRole === role.id && 'is-selected',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <header>
                            <h4>{role.title}</h4>
                            <p>
                              {role.range}
                              {role.location && <span>{role.location}</span>}
                            </p>
                          </header>
                          <MarkdownRenderer content={role.body} />
                        </article>
                      ))}
                    </div>
                  ))}
                </section>
              )
            }
            return (
              <section
                key={section.id}
                id={section.id}
                className="resume-section"
                ref={isAchievements(section.title) ? achievementsRef : undefined}
              >
                <h2 className="resume-section-title">{section.title}</h2>
                <MarkdownRenderer content={section.body} />
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
