// Parses content/pages/resume.md into sections, roles and skill groups.
// The markdown stays the source of truth; this only reads its structure.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

function splitAt(content, level) {
  const pattern = new RegExp(`^(?=${'#'.repeat(level)} )`, 'm')
  // Leading newline: split() skips a zero-width match at index 0, which would
  // fold a heading on the first line into the lead text
  const [lead, ...chunks] = `\n${content}`.split(pattern)
  return {
    lead: lead.trim(),
    chunks: chunks.map((chunk) => {
      const [first, ...rest] = chunk.split('\n')
      return { title: first.replace(/^#+\s*/, '').trim(), body: rest.join('\n').trim() }
    }),
  }
}

export function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// "May 2025" -> 2025.33 (fractional year)
function toYear(text) {
  const match = text.trim().match(/^([a-z]+)\s+(\d{4})$/i)
  if (!match) return null
  const month = MONTHS.indexOf(match[1].toLowerCase())
  return Number(match[2]) + (month < 0 ? 0 : month) / 12
}

function parseRole(company, { title, body }) {
  const [dateLine = '', ...rest] = body.split('\n')
  const [location = '', range = ''] = dateLine.split('|').map((s) => s.trim())
  const [startText = '', endText = ''] = range.split(/\s+-\s+|\s+–\s+/)
  return {
    id: slugify(`${company}-${title}`),
    company,
    title,
    location,
    range,
    start: toYear(startText),
    end: toYear(endText),
    body: rest.join('\n').trim(),
  }
}

export function parseResume(content) {
  const { lead, chunks } = splitAt(content, 2)
  const sections = chunks.map((chunk) => ({ ...chunk, id: slugify(chunk.title) }))

  const info = sections.find((s) => /personal information/i.test(s.title))
  const name = info?.body.match(/Full Name\**:?\**\s*\*?([^*\n]+)/i)?.[1].trim()

  const experience = sections.find((s) => /experience/i.test(s.title))
  const companies = experience
    ? splitAt(experience.body, 3).chunks.map(({ title, body }) => ({
        name: title,
        roles: splitAt(body, 4).chunks.map((role) => parseRole(title, role)),
      }))
    : []

  const skillsSection = sections.find((s) => /skills/i.test(s.title))
  const skillGroups = skillsSection
    ? splitAt(skillsSection.body, 4).chunks.map(({ title, body }) => ({
        title,
        // Short comma-separated items become filter chips; prose lines are skipped
        skills: body.includes('(')
          ? []
          : body.split(',').map((s) => s.trim()).filter((s) => s && s.length <= 32),
      }))
    : []

  return { name, tagline: lead, sections, companies, skillGroups }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// "Node.js/TypeScript" matches either part; letters on either side block partial words
export function skillPattern(skill) {
  const parts = skill.split('/').map((p) => p.trim()).filter(Boolean).map(escapeRegExp)
  return new RegExp(`(?<![A-Za-z0-9])(?:${parts.join('|')})(?![A-Za-z0-9])`, 'gi')
}

export function roleUsesSkill(pattern, role) {
  pattern.lastIndex = 0
  return pattern.test(`${role.title}\n${role.body}`)
}

// Money, percentages and durations in the achievements
export const METRIC_PATTERN = /\$\d[\d.,]*\s?[KMB]?|\d+(?:\.\d+)?%|\d+[–-]\d+ days|\d+-day/g
