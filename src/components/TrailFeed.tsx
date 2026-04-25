"use client";

import { useMemo } from "react";
import type { TrailEventDto } from "@/lib/types";

interface Props {
  trail: TrailEventDto[];
  onNavigate: (workId: string) => void;
}

// ── Event metadata ────────────────────────────────────────────────────
const EVENT_META: Record<string, { glyph: string; label: string; }> = {
  OPEN_WORK:    { glyph: "📖", label: "Opened" },
  OPEN_PASSAGE: { glyph: "¶",   label: "Read passage" },
  ANNOTATE:     { glyph: "✎",   label: "Annotated" },
  REPLY:        { glyph: "↳",   label: "Replied" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Group consecutive events for the same work
function groupTrail(trail: TrailEventDto[]) {
  const groups: { workId: string; title: string; events: TrailEventDto[] }[] = [];
  for (const event of trail) {
    const last = groups[groups.length - 1];
    if (last && last.workId === event.workId) {
      last.events.push(event);
    } else {
      groups.push({
        workId: event.workId ?? "",
        title: event.work?.title ?? "Unknown work",
        events: [event],
      });
    }
  }
  return groups;
}

export function TrailFeed({ trail, onNavigate }: Props) {
  const groups = useMemo(() => groupTrail(trail), [trail]);

  if (trail.length === 0) {
    return (
      <main className="trail">
        <h2>My Trail</h2>
        <div className="trail-empty">
          <span className="trail-empty-glyph">&#x2767;</span>
          <p>Your trail is empty.</p>
          <p className="trail-empty-sub">Open a work from the corpus to begin reading. The trail records every passage you visit and every annotation you leave.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="trail">
      <h2>My Trail</h2>
      <p className="trail-meta">{trail.length} event{trail.length !== 1 ? "s" : ""} across {groups.length} session{groups.length !== 1 ? "s" : ""}</p>

      <div className="trail-timeline">
        {groups.map((group, gi) => (
          <div key={`${group.workId}-${gi}`} className="trail-group">
            {/* Work heading — clickable */}
            <button
              className="trail-group-title"
              onClick={() => { if (group.workId) onNavigate(group.workId); }}
            >
              <span className="trail-group-dot" />
              <span className="trail-group-name">{group.title}</span>
              <span className="trail-group-arrow">→</span>
            </button>

            {/* Individual events */}
            <ul className="trail-events">
              {group.events.map((event) => {
                const meta = EVENT_META[event.eventType] ?? { glyph: "○", label: event.eventType };
                return (
                  <li key={event.id} className="trail-event">
                    <span className="trail-event-glyph" aria-hidden="true">{meta.glyph}</span>
                    <span className="trail-event-label">{meta.label}</span>
                    <time
                      className="trail-event-time"
                      dateTime={event.createdAt}
                      title={new Date(event.createdAt).toLocaleString()}
                    >
                      {relativeTime(event.createdAt)}
                    </time>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
