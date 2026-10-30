import { useEffect, useMemo, useState } from 'react'
import { usePage } from '../hooks/useMarkdown'
import { getAllPosts } from '../utils/content'
import MarkdownRenderer from '../components/MarkdownRenderer'
import AboutScene from '../components/AboutScene'

// Pick a scene from the section heading, so renaming or adding sections in
// about.md keeps working without code changes
const SCENE_RULES = [
  [/flowdesk|mcp/i, 'network'],
  [/paxos|itbit|stablecoin/i, 'coins'],
  [/web|visuali[sz]ation|before/i, 'grid'],
  [/open source|project/i, 'clusters'],
  [/ai workflow|agent/i, 'agents'],
  [/stack|focus|platform/i, 'lattice'],
  [/site|notes/i, 'notes'],
]

function sceneFor(heading) {
  return SCENE_RULES.find(([pattern]) => pattern.test(heading))?.[1] || 'stream'
}

// Split the markdown at level-2 headings: the text before the first one is the intro
function splitSections(content) {
  const [intro, ...rest] = content.split(/^(?=## )/m)
  return {
    intro: intro.trim(),
    sections: rest.map((chunk, i) => {
      const heading = chunk.match(/^## (.+)$/m)?.[1] || ''
      return { id: `section-${i}`, scene: sceneFor(heading), content: chunk }
    }),
  }
}

export default function About() {
  const { page, loading } = usePage('about')
  const posts = getAllPosts()
  const [scene, setScene] = useState('stream')
  const { intro, sections } = useMemo(() => splitSections(page?.content || ''), [page])

  useEffect(() => {
    if (!sections.length || !('IntersectionObserver' in window)) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setScene(entry.target.dataset.scene)
        })
      },
      { rootMargin: '-45% 0px -45% 0px' }
    )
    document.querySelectorAll('.about-section').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  if (!loading && !page) {
    return <p className="empty-state">The about page is missing. Check content/pages/about.md.</p>
  }

  return (
    <div className="about-layout">
      <div className="about-text">
        <header className="about-intro about-section" data-scene="stream">
          <h1 className="page-title">{page?.title || 'About me'}</h1>
          {intro && <MarkdownRenderer content={intro} />}
        </header>
        {sections.map((section) => (
          <section key={section.id} className="about-section" data-scene={section.scene}>
            <MarkdownRenderer content={section.content} />
          </section>
        ))}
      </div>
      <AboutScene scene={scene} posts={posts} />
    </div>
  )
}
