# CLAUDE.md — Reading Box

## Project Overview
Reading Box is a communal co-reading web app. Users read texts from Project Gutenberg together, highlight passages, annotate threads, reply to each other, and follow a shared reading trail.

**Stack:** Next.js 15 App Router · TypeScript strict · Prisma ORM · PostgreSQL · D3.js (force graph) · Plain CSS custom properties · No Tailwind · No CSS-in-JS

---

## Launch
Always launch Claude Code from the project root:
```
cd "C:\Users\l\Desktop\Kutsera Robi kalandozások\read mind\reading-box-demo"
claude --model qwen2.5-coder:14b
```

File paths in prompts must be **relative**: `src/app/globals.css` — NOT `/src/app/globals.css`

Never paste PowerShell commands into the Claude Code prompt — it will try to execute them as tool calls.

---

## File Map

| Path | Purpose |
|---|---|
| `src/app/globals.css` | Design tokens + ALL component styles (no other CSS files) |
| `src/components/reading-box-app.tsx` | Root state container — all state lives here, composes child components |
| `src/components/CorpusGraph.tsx` | D3 force-directed graph of works |
| `src/components/CorpusList.tsx` | List view of works |
| `src/components/PassageReader.tsx` | Passage display, annotation compose, inline threads |
| `src/components/ContextPanel.tsx` | Reference neighborhood sidebar |
| `src/components/TrailFeed.tsx` | Reading trail list |
| `src/components/AnnotationsFeed.tsx` | Global annotations feed |
| `src/lib/types.ts` | All DTOs: WorkDto, ReaderDto, PassageDto, InlineAnnotationDto, ReplyDto, AnnotationDto, TrailEventDto, SelectionState |
| `src/lib/prisma.ts` | Prisma client singleton |
| `prisma/schema.prisma` | Work, Edition, Passage, Annotation, Reference, TrailEvent models |
| `src/app/api/works/route.ts` | GET /api/works |
| `src/app/api/reader/[editionId]/route.ts` | GET /api/reader/:editionId |
| `src/app/api/annotations/route.ts` | GET, POST, PATCH /api/annotations |
| `src/app/api/trail/route.ts` | GET, POST /api/trail |
| `src/app/api/graph/route.ts` | GET /api/graph |
| `scripts/` | Gutenberg importer + demo seed |

---

## Conventions

### CSS
- All styles live in `src/app/globals.css` only
- Use classnames defined there — no inline styles, no CSS modules, no styled-components
- No `cn()`, no `clsx` — plain string classnames only
- Design tokens: `--color-*`, `--space-*`, `--text-*`, `--font-display`, `--font-body`, `--radius-*`, `--shadow-*`, `--transition`
- Light/dark mode via `data-theme` attribute on `<html>`

### State
- All `useState` / `useRef` / `useMemo` / `useEffect` live in `ReadingBoxApp` only
- Child components receive typed props and emit callbacks — no internal state
- No React Context, no Zustand, no Redux

### Types
- All DTOs live in `src/lib/types.ts`
- **No `Record<string, unknown>` anywhere in the codebase**
- API routes must return data matching the DTOs in `types.ts`

### Components
- `"use client"` only in files that use hooks or browser APIs
- Props interfaces use named types from `@/lib/types`

### API Routes
- Export named `GET` / `POST` / `PATCH` functions
- Never return `Record<string, unknown>` — always return a typed object

---

## Common Tasks

### Add a component
1. Create `src/components/MyComponent.tsx` with `"use client"` if needed
2. Define a `Props` interface using DTOs from `@/lib/types`
3. Add classnames to `src/app/globals.css`
4. Import and render in `reading-box-app.tsx`

### Add an API route
1. Create `src/app/api/route-name/route.ts`
2. Export named `GET` / `POST` / `PATCH` handlers
3. Add corresponding DTO to `src/lib/types.ts`
4. Never return `Record<string, unknown>`

### Modify the schema
1. Edit `prisma/schema.prisma`
2. `npx prisma migrate dev --name describe-change`
3. Update affected API routes and DTOs in `types.ts`

---

## Dev Commands

```powershell
npm run dev                                    # start on localhost:3000
npx prisma migrate dev --name <name>           # apply schema migration
npx prisma studio                              # browse database
npx ts-node scripts/seed-demo.ts               # seed Gutenberg demo data
npm run build                                  # production build — run after each task
```

---

## What NOT To Do
- Do not install Tailwind, shadcn, or any component library
- Do not use CSS modules or styled-components
- Do not add state management libraries
- Do not use `Record<string, unknown>` in types or components
- Do not fetch URLs from within Claude Code — use the Read tool on local files only
- Do not move state out of `ReadingBoxApp` without explicit instruction
- Do not use absolute paths like `/src/app/globals.css` — always relative
- Do not paste PowerShell/shell commands into the Claude Code prompt
