# CLAUDE.md — Reading Box

Project conventions for Claude Code sessions. Read this file at the start of every session.
**Never fetch URLs. Always use the Read tool on local files.**

## Project Overview

Reading Box is a communal co-reading web app for philosophical and alchemical texts.
Users move through a shared corpus, leave annotation threads on passages, and build
a personal reading trail — with indirect traces of other readers visible throughout.

**Stack:** Next.js 15 App Router · TypeScript (strict) · Prisma ORM · PostgreSQL · D3 (force graph) · Plain CSS with CSS custom properties (no Tailwind, no CSS-in-JS, no component libraries)

## File Map

```
src/
  app/
    globals.css                      # All design tokens + every component style
    layout.tsx                       # Root layout — loads globals.css, no Tailwind
    page.tsx                         # Cover/landing page
    demo/page.tsx                    # Mounts <ReadingBoxApp />
    api/
      works/route.ts                 # GET /api/works
      reader/[editionId]/route.ts    # GET /api/reader/:editionId
      annotations/route.ts           # GET, POST, PATCH /api/annotations
      trail/route.ts                 # GET, POST /api/trail
      graph/route.ts                 # GET /api/graph
  components/
    reading-box-app.tsx              # Root state container — all useState/useEffect here
  lib/
    types.ts                         # All DTOs: WorkDto, ReaderDto, PassageDto,
                                     #   InlineAnnotationDto, ReplyDto,
                                     #   AnnotationDto, TrailEventDto, SelectionState
    db.ts                            # Prisma client singleton (export: db)
    ingest.ts                        # Gutenberg ingest logic
    normalize.ts                     # Text selector helpers (buildSelector)
prisma/
  schema.prisma                      # Work, Edition, Passage, Annotation, Reference, TrailEvent
scripts/                             # Gutenberg importer + demo seed
```

## Conventions

### CSS
- All styles live in `src/app/globals.css`. No inline styles, no CSS modules, no styled-components.
- All classnames are plain strings — no `cn()`, no `clsx`, no conditional class libraries.
- Every spacing value uses a `--space-*` token. Every font size uses a `--text-*` token.
- New classnames must be added to `globals.css` before being used in a component.
- Light/dark mode via `[data-theme]` attribute on `<html>`. Toggle sets it via `document.documentElement.setAttribute("data-theme", ...)`.

### State
- All `useState`, `useRef`, `useEffect`, and async fetch functions live in `ReadingBoxApp`.
- Child components receive typed props and emit callbacks. No React Context, no Zustand, no Redux.
- `"use client"` only in files that use hooks or browser APIs.

### Types
- All DTOs live in `src/lib/types.ts`. Import from `@/lib/types`.
- `Record<string, unknown>` is forbidden — every API response must be typed with a DTO.
- API routes must return shapes that exactly match the corresponding DTO.

### Database
- Prisma client imported from `@/lib/db` as `db` (singleton pattern).
- After schema changes: `npx prisma migrate dev --name describe-change`
- Never call `db` from client components — only from API routes.

## Design Tokens (globals.css)

| Category | Prefix | Example |
|---|---|---|
| Colors | `--color-*` | `--color-primary`, `--color-text-muted` |
| Spacing | `--space-*` | `--space-4` = 1rem, `--space-8` = 2rem |
| Type scale | `--text-*` | `--text-base` = fluid 16–18px |
| Fonts | `--font-display`, `--font-body` | EB Garamond, Lora |
| Radius | `--radius-*` | `--radius-md` = 0.5rem |
| Shadows | `--shadow-sm`, `--shadow-md` | warm-tinted oklch shadows |
| Transition | `--transition` | 180ms ease-out |

Light mode: warm parchment (`#f5f0e8` bg, `#7a4f1e` primary oak).
Dark mode: rich dark ink (`#1a1510` bg, `#c8965a` primary).

## Common Tasks

### Add a new component
1. Create `src/components/MyComponent.tsx` with `"use client"` if it uses hooks.
2. Define a typed props interface — all prop types must come from `@/lib/types`.
3. Add the new classnames to `globals.css` following the existing pattern.
4. Import and render it from `reading-box-app.tsx`, passing state down as props.

### Add a new API route
1. Create `src/app/api/route-name/route.ts`.
2. Export named `GET` / `POST` / `PATCH` functions.
3. Add a corresponding DTO to `src/lib/types.ts`.
4. Never return `Record<string, unknown>` — always return a typed object.

### Modify the database schema
1. Edit `prisma/schema.prisma`.
2. Run: `npx prisma migrate dev --name describe-change`
3. Update the affected API routes and DTOs in `types.ts`.

## Running Locally

```bash
npx prisma migrate dev          # Apply pending migrations
npx ts-node scripts/seed.ts     # Seed Gutenberg demo data
npm run dev                     # Start dev server on localhost:3000
npm run build                   # Type-check + production build
```

## What NOT To Do

- Do **not** install Tailwind, shadcn, Radix, or any component library.
- Do **not** use CSS modules, styled-components, or inline `style={{}}` props.
- Do **not** add state management libraries (Zustand, Redux, Jotai, etc.).
- Do **not** use `Record<string, unknown>` in `types.ts` or component files.
- Do **not** call `db` from a client component — only from API routes.
- Do **not** move state out of `ReadingBoxApp` without explicit instruction.
- Do **not** fetch URLs — use the Read tool on local files only.
