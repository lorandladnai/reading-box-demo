"use client";

import type { TrailEventDto } from "@/lib/types";

interface Props {
  trail: TrailEventDto[];
  onNavigate: (workId: string) => void;
}

export function TrailFeed({ trail, onNavigate }: Props) {
  return (
    <main className="trail">
      <h2>My Trail</h2>
      {trail.length === 0 ? (
        <p className="passages-empty">No trail yet — open a work to begin.</p>
      ) : (
        trail.map((event, idx) => (
          <button
            key={idx}
            className="trail-item"
            onClick={() => {
              if (event.workId) onNavigate(event.workId);
            }}
          >
            {event.work?.title ?? "Unknown work"} · {event.eventType}
          </button>
        ))
      )}
    </main>
  );
}
