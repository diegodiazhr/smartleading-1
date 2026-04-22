This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## BDNS Grant Pipeline

This project now includes a first-pass grant ingestion pipeline for Spanish public subsidies:

- `POST /api/admin/sync-bdns`
  Syncs BDNS grants into the flat `grants` table and also persists canonical artifacts into:
  `grant_programs`, `grant_calls`, `grant_source_records`, `grant_eligibility_rules`,
  `grant_funding_terms`, `grant_document_requirements`, `grant_expense_rules`,
  and `grant_field_evidence`.
- `GET /api/grants/search`
  Searches against the canonical model first (`grant_calls` + eligibility + funding terms)
  and falls back to `grants` only if canonical data is not available yet.
- `GET /api/cron/sync-bdns`
  Intended for scheduled incremental syncs.

Optional request body for `POST /api/admin/sync-bdns`:

```json
{
  "maxPagesPerVpd": 200,
  "pageSize": 50,
  "persistArtifacts": true,
  "fetchSourceDocuments": false
}
```

Database support for the canonical pipeline lives in:

- `supabase/migrations/20260420173000_grant_pipeline.sql`
- `supabase/migrations/20260420181500_grant_search_indexes.sql`

Notes:

- The canonical pipeline is additive: existing app screens can keep reading from `grants`.
- The search API now ranks on text relevance, business fit, freshness, amount, and source quality.
- Source-document fetching is optional because it is slower and depends on third-party portals.
- HTML/text sources are stored as snapshots today; richer PDF/OCR extraction can be layered on top next.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
