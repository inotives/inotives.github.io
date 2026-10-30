export const SERIES_META = {
  'building-ai-systems': {
    title: 'Building AI systems that scale',
    description:
      'Notes on designing, operating, and cost-controlling agentic AI systems in production. Covers loop prevention, token budgeting, human-in-the-loop design, and the architectural patterns that separate working deployments from expensive failures.',
  },
  'data-engineering': {
    title: 'Data engineering',
    description:
      'Notes on building and operating data pipelines, ELT stacks, data modeling, and the infrastructure that turns raw data into something useful.',
  },
  'data-engineering-in-30-days': {
    title: 'Data engineering in 30 days',
    description:
      'A practical learning path from SQL and files to reliable pipelines, warehouses, and AI-ready data systems. Each entry takes one concept far enough to build with it.',
  },
  'building-motherduck-warehouse': {
    title: 'Building a MotherDuck data warehouse',
    description:
      'A practical series on taking a local DuckDB proof of concept to a governed MotherDuck warehouse with S3, Prefect, dbt, and a deliberate path to larger-scale storage.',
  },
}

export const SERIES_SLUGS = Object.keys(SERIES_META)
