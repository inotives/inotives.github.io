// Content dates are plain YYYY-MM-DD strings; parse at local noon so the
// calendar day never shifts with the reader's timezone.
export function parseDate(value) {
  return new Date(`${value}T12:00:00`)
}

export function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatShort(value) {
  return parseDate(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function formatLong(value) {
  return parseDate(value).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatMonth(value) {
  return parseDate(`${value.slice(0, 7)}-01`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

export function isRecent(value, days = 7) {
  return (Date.now() - parseDate(value).getTime()) / 86400000 <= days
}
