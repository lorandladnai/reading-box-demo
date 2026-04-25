"use client";

import type { WorkDto } from "@/lib/types";

interface Props {
  works: WorkDto[];
  selectedWorkId: string | null;
  onSelect: (id: string) => void;
}

export function ContextPanel({ works, selectedWorkId, onSelect }: Props) {
  const selected = works.find((w) => w.id === selectedWorkId);

  return (
    <aside className="context-panel">
      <h3>Context Map</h3>
      {!selected ? (
        <p>Select a work to view its local reference neighbourhood.</p>
      ) : (
        <>
          <div className="context-group">
            <h4>References</h4>
            {selected.references.length === 0 ? (
              <p>None recorded.</p>
            ) : (
              selected.references.map((r) => (
                <button key={r.targetWorkId} onClick={() => onSelect(r.targetWorkId)}>
                  {r.targetTitle}
                </button>
              ))
            )}
          </div>
          <div className="context-group">
            <h4>Cited by</h4>
            {selected.citedBy.length === 0 ? (
              <p>None recorded.</p>
            ) : (
              selected.citedBy.map((r) => (
                <button key={r.sourceWorkId} onClick={() => onSelect(r.sourceWorkId)}>
                  {r.sourceTitle}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
}
