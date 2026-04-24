# Reading Box Demo

Serious vertical-slice demo for a communal co-reading product:
- corpus import from Gutenberg/Gutendex,
- canonical passage model,
- robust quote selectors for annotations (exact/prefix/suffix + offsets),
- threaded replies with open/closed thread state,
- corpus and annotation graph projection APIs,
- personal "My Trail" route events.

## Stack
- Next.js (App Router) + TypeScript
- Prisma + PostgreSQL
- Cheerio for normalization
- D3/Cytoscape-compatible graph projection APIs

## 1) Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`.
2. Generate Prisma client and push schema:

```bash
npm run db:generate
npm run db:push
```

## 2) Ingest Gutenberg work

Default import uses Gutendex book id `2680`.

```bash
npm run import:gutenberg
```

You can import another id:

```bash
npm run import:gutenberg -- 1342
```

## 3) Run app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data model (core)

- `Work` (abstract text-level entity)
- `Edition` (source-specific version)
- `Passage` (stable reader units)
- `Annotation` (thread root + replies via `parentId`)
- `Reference` (work-to-work edge)
- `TrailEvent` (reading movement)

## API endpoints

- `GET /api/works`
- `GET /api/reader/:editionId`
- `GET|POST|PATCH /api/annotations`
- `GET /api/graph`
- `GET|POST /api/trail`
