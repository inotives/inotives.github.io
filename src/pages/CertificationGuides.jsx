const guides = [
  {
    title: 'AWS Cloud Practitioner (CLF-C02)',
    description: 'A practical study guide for the AWS Certified Cloud Practitioner exam.',
    href: '/learnings/aws-clf-c02-study-guides.html',
    provider: 'AWS',
    code: 'CLF-C02',
  },
]

export default function CertificationGuides() {
  return (
    <div className="page-stack">
      <section className="manual-section">
        <p className="label">Index / learning guides</p>
        <h1 className="page-title">Certification Guides</h1>
        <p className="section-copy">
          Study guides and practical reference material for technology certifications.
        </p>
      </section>

      <section className="notes-layout">
        <div className="notes-main">
          <p className="notes-count">
            {guides.length} {guides.length === 1 ? 'guide' : 'guides'}
          </p>
          <div className="record-list">
            {guides.map((guide) => (
              <a key={guide.href} href={guide.href} className="record">
                <div className="record-meta">
                  <span>{guide.provider}</span>
                  <span>{guide.code}</span>
                </div>
                <h2 className="record-title">{guide.title}</h2>
                <p className="record-copy">{guide.description}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
