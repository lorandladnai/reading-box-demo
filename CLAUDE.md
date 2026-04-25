# CLAUDE.md — Reading Box

Project conventions for Claude Code sessions. **Always use the `Read` tool on local files. Never fetch URLs.**

---

## Project Overview

Reading Box is a communal co-reading web app. Users browse a corpus of literary works, read passages, highlight text, annotate, reply to threads, and trace their reading history.

**Stack:** Next.js 15 App Router · TypeScript (strict) · Prisma ORM · PostgreSQL · D3 (force graph) · plain CSS with CSS custom properties

---

## File Map

| Path | Owns |
|---|---|
| `src/app/globals.css` | All design tokens + every component's CSS. Single source of style truth. |
| `src/components/reading-box-app.tsx` | Root state container. Composes child components. All `useState`/`useEffect`/`useRef` live here. |
| `src/components/CorpusGraph.tsx` | D3 force-simulation graph of works + edges. |
| `src/components/CorpusList.tsx` | Flat list of works for the left sidebar. |
| `src/components/PassageReader.tsx` | Passage display, text selection, annotation compose, inline threads. Also owns `resolveSelectionOffsets` helper. |
| `src/components/ContextPanel.tsx` | Right sidebar: references and cited-by for the selected work. |
| `src/components/TrailFeed.tsx` | My Trail tab: ordered list of trail events. |
| `src/components/AnnotationsFeed.tsx` | Annotations tab: global list of all annotations with reply compose. |
| `src/lib/types.ts` | All DTOs. Single source of type truth. |
| `prisma/schema.prisma` | Work, Edition, Passage, Annotation, Reference, TrailEvent models. |
| `src/app/api/works/route.ts` | `GET /api/works` |
| `src/app/api/reader/[editionId]/route.ts` | `GET /api/reader/:editionId` |
| `src/app/api/annotations/route.ts` | `GET`, `POST`, `PATCH /api/annotations` |
| `src/app/api/trail/route.ts` | `GET`, `POST /api/trail` |
| `src/app/api/graph/route.ts` | `GET /api/graph` |
| `scripts/` | Gutenberg importer and demo seed. |

---

## Types

All DTOs live in `src/lib/types.ts`. Import from `@/lib/types` everywhere.

| Type | Used for |
|---|---|
| `WorkDto` | Works list from `/api/works` |
| `ReaderDto` | Edition + passages + annotations from `/api/reader/:id` |
| `PassageDto` | `ReaderDto["passages"][number]` |
| `InlineAnnotationDto` | `ReaderDto["annotations"][number]` |
| `ReplyDto` | Replies within any annotation |
| `AnnotationDto` | Global annotations from `/api/annotations` |
| `TrailEventDto` | Trail events from `/api/trail` |
| `SelectionState` | `{ start, end, exact }` text selection |

**Never use `Record<string, unknown>` anywhere.** Always use a named DTO.

---

## Conventions

### CSS
- All styles live in `src/app/globals.css` using plain classnames.
- No inline styles. No CSS modules. No styled-components. No Tailwind.
- All classnames are plain strings — no `cn()`, no `clsx`.
- Tokens: `--color-*`, `--space-*`, `--text-*`, `--font-display`, `--font-body`, `--radius-*`, `--shadow-*`, `--transition`.
- Light/dark via `[data-theme]` attribute on `<html>`. Toggle sets `data-theme="light"` or `data-theme="dark"`.

### Components
- `"use client"` only on files that use hooks or browser APIs.
- State lives **only** in `ReadingBoxApp`. Child components receive typed props and emit callbacks.
- No React Context, no Zustand, no Redux.
- Props interfaces are always named `Props` (local to the file) and typed with DTOs from `@/lib/types`.

### API routes
- Export named `GET`/`POST`/`PATCH` functions.
- Never return `Record<string, unknown>`. Always return a typed DTO object.
- Add the corresponding DTO to `src/lib/types.ts` when adding a new route.

### Database
- Prisma client singleton at `@/lib/prisma`.
- After schema changes: `npx prisma migrate dev --name describe-change`.

---

## Common Tasks

### Add a new component
1. Create `src/components/MyComponent.tsx` with `"use client"` if it uses hooks.
2. Define a `Props` interface using DTOs from `@/lib/types`.
3. Add classnames to `globals.css` following the existing token pattern.
4. Import and render from `reading-box-app.tsx`.

### Add a new API route
1. Create `src/app/api/route-name/route.ts`.
2. Export named `GET`/`POST`/`PATCH` handlers.
3. Add the DTO to `src/lib/types.ts`.

### Modify the database schema
1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name describe-change`
3. Update affected API routes and DTOs.

---

## Running Locally

```bash
# Apply migrations
npx prisma migrate dev

# Seed Gutenberg demo data
npx ts-node scripts/seed-demo.ts

# Start dev server
npm run dev          # http://localhost:3000
```

---

## What NOT to Do

- Do **not** install Tailwind, shadcn, or any component library.
- Do **not** use CSS modules or styled-components.
- Do **not** add state management libraries (no Zustand, Redux, Jotai).
- Do **not** use `Record<string, unknown>` — always use a named DTO.
- Do **not** move state out of `ReadingBoxApp` without explicit instruction.
- Do **not** fetch URLs from within Claude Code — use the `Read` tool on local files.
- Do **not** add `"use client"` to files that don't need it.
