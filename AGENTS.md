# Agents Guide — Reading Box Demo

This file tells AI coding agents (Codex, Copilot, Claude, etc.) how the codebase is
structured and what invariants must be preserved when making edits.

---

## Core Invariant: The Passage Selector Contract

Every `Annotation` row anchors to a passage via a **three-field selector**:

| Field | Type | Meaning |
|---|---|---|
| `exact` | `string` | The selected text verbatim |
| `prefix` | `string` | Up to 32 chars immediately before the selection |
| `suffix` | `string` | Up to 32 chars immediately after the selection |
| `startOffset` | `int` | Character offset from start of `passage.text` |
| `endOffset` | `int` | Character offset end (exclusive) |

`buildSelector()` in `src/lib/normalize.ts` derives `exact/prefix/suffix` from
`startOffset`/`endOffset` on the server. **Never store an annotation without calling
`buildSelector` first** — the `exact` field must never be empty.

The selector is modelled after the W3C Web Annotation `TextQuoteSelector` +
`TextPositionSelector` standards. If text is re-ingested, offsets may drift; the
prefix/suffix fields allow fuzzy re-anchoring.

---

## Data Model Summary

```
Work (slug unique)
  └─ Edition (source=gutenberg, sourceId=gutendex id)
       └─ Passage (passageIndex asc, charStart/charEnd = absolute offsets in edition)
            └─ Annotation (parentId=null → thread root; parentId set → reply)
Work ─── Reference ──▶ Work  (outgoing/incoming, relation: influence|response|commentary|allusion)
Work ─── TrailEvent (userId, eventType: OPEN_WORK|OPEN_PASSAGE|ANNOTATE|REPLY)
```

---

## API Surface

| Method | Path | Notes |
|---|---|---|
| GET | `/api/works` | All works with references/citedBy, editionId |
| GET | `/api/reader/:editionId?page=1&pageSize=60` | Paginated passages + all annotations for edition |
| GET | `/api/annotations` | All root annotations sorted by attention score |
| POST | `/api/annotations` | Create root annotation (server derives exact/prefix/suffix) |
| PATCH | `/api/annotations` | Close thread (`action:close`) or add reply |
| DELETE | `/api/annotations?id=:id` | Delete annotation or reply |
| GET | `/api/graph` | D3/Cytoscape payload: corpus nodes+edges + annotation nodes+edges |
| GET | `/api/trail?userId=alice` | Trail events for a user (PUBLIC only) |
| POST | `/api/trail` | Record a trail event |

---

## Multi-User Convention

The demo has no auth. User identity is passed as `userName` in annotation/trail
payloads. The UI exposes a user switcher (`?user=alice` / `?user=bob`). The seed
script pre-populates cross-user annotation threads.

**Do not add real auth** to this demo — keep it frictionless.

---

## Passage Pagination

`/api/reader/:editionId` accepts `?page=` (1-based) and `?pageSize=` (default 60,
max 200). The response includes `totalPassages`, `page`, `pageSize` so the UI can
render a page navigator. Long texts like *The Republic* have 200+ passages — always
paginate.

---

## Ingest

`src/lib/ingest.ts` fetches from Gutendex, strips Gutenberg boilerplate, chunks into
paragraph-level passages (≥40 chars, max 220 passages per ingest). Passages are
deleted and re-created on each import. Do not call `ingest` inside an API route —
it is a CLI-only script.

---

## Style Conventions

- TypeScript strict mode. No `any` — use `unknown` + type narrowing.
- All DB access via `src/lib/db.ts` singleton.
- API routes use Zod for input validation.
- CSS variables only — no Tailwind utility classes in component files (globals.css defines all tokens).
