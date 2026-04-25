# Reading Box — Project Conventions

## Overview
Communal co-reading web app. Users open works, select passages, annotate inline, reply in threads, and trace a reading trail. Built as a Next.js 15 App Router project with a Prisma/PostgreSQL backend and plain CSS.

## Stack
- **Framework**: Next.js 15 App Router (React Server Components + `"use client"` where needed)
- **Language**: TypeScript strict mode
- **Database**: PostgreSQL via Prisma ORM
- **Styling**: Plain CSS in `src/app/globals.css` — no Tailwind, no CSS modules, no CSS-in-JS
- **Graph**: D3 v7 (force simulation in `CorpusGraph.tsx`)
- **Validation**: Zod (API routes only)
- **Local model**: `qwen2.5-coder:14b` via Ollama + Claude Code

## File Map

| Path | Owns |
|---|---|
| `src/app/globals.css` | All design tokens + every component classname style |
| `src/lib/types.ts` | All DTOs (`WorkDto`, `ReaderDto`, `PassageDto`, `InlineAnnotationDto`, `ReplyDto`, `AnnotationDto`, `TrailEventDto`, `SelectionState`) |
| `src/components/reading-box-app.tsx` | Root state container — all `useState`, `useEffect`, async handlers; composes the six child components |
| `src/components/CorpusGraph.tsx` | D3 force graph with drag + zoom + node highlight |
| `src/components/CorpusList.tsx` | Flat list of works in the left sidebar |
| `src/components/PassageReader.tsx` | Passage display, selection, inline annotation compose, thread replies; also owns `resolveSelectionOffsets` helpers |
| `src/components/ContextPanel.tsx` | Right sidebar — references and cited-by for the selected work |
| `src/components/TrailFeed.tsx` | Trail tab — ordered list of `TrailEventDto` |
| `src/components/AnnotationsFeed.tsx` | Annotations tab — global sorted thread list with reply compose |
| `src/app/api/works/route.ts` | `GET /api/works` |
| `src/app/api/reader/[editionId]/route.ts` | `GET /api/reader/:editionId` |
| `src/app/api/annotations/route.ts` | `GET`, `POST`, `PATCH /api/annotations` |
| `src/app/api/trail/route.ts` | `GET`, `POST /api/trail` |
| `src/app/api/graph/route.ts` | `GET /api/graph` |
| `prisma/schema.prisma` | `Work`, `Edition`, `Passage`, `Annotation`, `Reference`, `TrailEvent` models |
| `scripts/` | Gutenberg importer + demo seed |

## Conventions

### Styling
- All styles live in `src/app/globals.css`. One file, no exceptions.
- Use CSS custom properties (`--color-*`, `--space-*`, `--text-*`, `--font-*`, `--radius-*`, `--shadow-*`, `--transition`) for every value. Never hardcode pixels, hex, or rem.
- Classnames are plain strings — no `cn()`, no `clsx`, no conditional class utilities.
- Dark/light mode via `[data-theme="dark"]` / `[data-theme="light"]` attribute on `<html>`. The toggle in the topbar sets this.

### Components
- State lives **only** in `ReadingBoxApp`. Child components receive typed props and emit typed callbacks.
- No React Context, no Zustand, no Redux.
- Add `"use client"` at the top of any file that uses hooks or browser APIs.
- When adding a new component: create `src/components/MyComponent.tsx`, style its classnames in `globals.css`, import and compose it in `reading-box-app.tsx`.

### Types
- All DTOs live in `src/lib/types.ts`. No `Record<string, unknown>` anywhere in the codebase.
- API route return shapes must match the exported DTO in `types.ts`.
- When adding a new API route, add its DTO to `types.ts` first, then implement the route.

### API Routes
- Export named `GET` / `POST` / `PATCH` functions — never a default export.
- Use Zod for input validation. Return `NextResponse.json()`.
- Include the Prisma `include` joins needed to satisfy the DTO shape.

### Database
- Prisma client singleton lives at `src/lib/db.ts` (imported as `db`).
- To change schema: edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name describe-change`.
- Update affected API routes and `types.ts` after any schema change.

## Common Tasks

### Add a new component
1. Create `src/components/MyComponent.tsx` with `"use client"` if it uses hooks.
2. Define a typed `Props` interface using DTOs from `@/lib/types`.
3. Add the component's classnames to `globals.css`.
4. Import and render it in `reading-box-app.tsx`, passing state down as props.

### Add a new API route
1. Add the return DTO to `src/lib/types.ts`.
2. Create `src/app/api/route-name/route.ts` with named exports.
3. Validate input with Zod; use `db` from `@/lib/db`.

### Modify the schema
1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name describe-change`
3. Update `src/lib/types.ts` and any affected API route.

## Running Locally
```bash
npx prisma migrate dev       # apply pending migrations
npx ts-node scripts/seed-demo.ts  # seed Gutenberg demo data
npm run dev                  # dev server → localhost:3000
```

## Do Not
- Install Tailwind, shadcn, or any component library.
- Use CSS modules, styled-components, or inline `style={{}}`.
- Add state management libraries.
- Use `Record<string, unknown>` anywhere — always define a proper type.
- Fetch URLs from within a Claude Code session — use the `Read` tool on local files.
- Move state out of `ReadingBoxApp` without explicit instruction.
