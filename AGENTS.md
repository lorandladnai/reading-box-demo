# Reading Box — Agent Guide

## Project Purpose

Reading Box is a communal co-reading platform. Users import literary works (via Gutenberg/Gutendex), read them passage-by-passage, annotate specific quotes with threaded discussions, and trace their reading journeys via personal "My Trail" routes. A graph projection API exposes work-to-work reference edges for D3/Cytoscape visualisation.

This is a vertical-slice demo: the goal is a working, well-tested slice of every core feature — not a polished UI.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Database ORM | Prisma + PostgreSQL |
| HTML parsing | Cheerio (for Gutenberg normalisation) |
| Graph APIs | D3/Cytoscape-compatible JSON output |
| Dev runtime | Node.js, npm |

> **IMPORTANT — Next.js version notice**
> This version of Next.js has breaking changes vs. common training data. Before writing any route, component, or config: read `node_modules/next/dist/docs/` for the installed version. Heed all deprecation notices. Do not assume App Router conventions from prior knowledge.

---

## Repository Layout

```
reading-box-demo/
├── prisma/
│   └── schema.prisma          # Full data model — read this first
├── src/
│   ├── app/                   # Next.js App Router pages + API routes
├──   ├── components/            # React components
│   └── lib/                   # Shared utilities, Prisma client, helpers
├── scripts/                   # CLI scripts (import, seed)
├── public/
├── .env.example               # Required env vars template
├── package.json
└── AGENTS.md                  # ← you are here
```

---

## Data Model (read before any DB work)

Defined in `prisma/schema.prisma`. Core entities:

- **Work** — abstract text-level entity (title, authors, subjects). Has outgoing/incoming `Reference` edges.
- **Edition** — source-specific version of a Work (Gutenberg id, language, format, raw HTML/text).
- **Passage** — stable reader unit within an Edition. Has `charStart`/`charEnd` offsets and `sectionKey`.
- **Annotation** — anchored quote on a Passage. Uses `exact`/`prefix`/`suffix`/`startOffset`/`endOffset` (Web Annotation spec). Supports threaded replies via self-referential `parentId`. Has `ThreadState` (OPEN/CLOSED).
- **Reference** — directed work-to-work edge with a `relation` label (e.g. "influences", "quotes").
- **TrailEvent** — reading movement log per user. Types: `OPEN_WORK`, `OPEN_PASSAGE`, `ANNOTATE`, `REPLY`. Has `Visibility` (PUBLIC/PRIVATE).

**Key relationships:**
- Work → Edition (1:many)
- Edition → Passage (1:many, ordered by `passageIndex`)
- Passage → Annotation (1:many)
- Annotation → Annotation (self-ref replies via `parentId`)
- Work → TrailEvent, Edition → TrailEvent, Passage → TrailEvent (optional)

---

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/works` | List all Works |
| GET | `/api/reader/:editionId` | Paginated passages for an Edition |
| GET | `/api/annotations` | Query annotations (by editionId, passageId) |
| POST | `/api/annotations` | Create annotation or reply |
| PATCH | `/api/annotations` | Update annotation state (OPEN/CLOSED) |
| GET | `/api/graph` | Work reference graph (nodes + edges) |
| GET | `/api/trail` | Trail events for a user |
| POST | `/api/trail` | Log a trail event |

---

## Dev Commands

```bash
# Install dependencies
npm install

# Set up database (copy .env.example → .env first, set DATABASE_URL)
npm run db:generate    # generate Prisma client
npm run db:push        # push schema to DB (no migrations)

# Import a single Gutenberg work (default: id 2680)
npm run import:gutenberg
npm run import:gutenberg -- 1342   # import by id

# Fast demo seed (multiple books + reference edges)
npm run seed:demo

# Run dev server
npm run dev            # http://localhost:3000
```

---

## Coding Conventions

- **TypeScript everywhere** — no `any` unless genuinely unavoidable; add a comment explaining why.
- **Prisma for all DB access** — import the shared client from `src/lib/` (do not instantiate new PrismaClient instances).
- **App Router conventions** — route handlers live in `src/app/api/*/route.ts`. Use `NextRequest`/`NextResponse`.
- **Annotation anchoring** — always store `exact`, `prefix`, `suffix`, `startOffset`, `endOffset`. Never anchor by line number or DOM position alone.
- **Passage stability** — `passageIndex` + `sectionKey` are the stable address of a passage. Do not renumber on re-import; use `ingestVersion` on Edition instead.
- **No auth layer yet** — `userName` and `userId` are plain strings. Do not add auth unless explicitly asked.
- **Graph output** — graph endpoints must return `{ nodes: [...], edges: [...] }` compatible with both D3 force-directed and Cytoscape.js.

---

## Testing

- Write tests for any non-trivial logic added to `src/lib/`.
- API route tests should use an isolated test DB or mock Prisma via `jest.mock`.
- Do not break existing import/seed scripts — run them to verify after schema changes.

---

## Agent Task Priorities

When given an open-ended task, prioritise in this order:

1. **Correctness of the data model** — schema changes must not break existing seed data or import scripts.
2. **API contract stability** — existing endpoint shapes must remain backward-compatible unless explicitly told otherwise.
3. **Annotation anchor fidelity** — quote selectors (exact/prefix/suffix/offsets) are the most fragile part; treat with care.
4. **Graph projection accuracy** — Reference edges must reflect actual work-to-work relationships.
5. **UI is secondary** — a working JSON API beats a polished but broken UI.

---

## Known Gaps / Future Work

- No authentication (userName/userId are free strings)
- No pagination on `/api/works` or `/api/graph`
- No full-text search on passages
- No real-time collaboration
- Trail visibility filter not yet enforced in queries
- No test suite yet
