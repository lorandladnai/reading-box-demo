"use client";

import type { WorkDto } from "@/lib/types";

interface Props {
  works: WorkDto[];
  onSelect: (id: string) => void;
}

export function CorpusList({ works, onSelect }: Props) {
  return (
    <div className="list">
      {works.map((w) => (
        <button key={w.id} onClick={() => onSelect(w.id)} className="work-item">
          <strong>{w.title}</strong>
          <span>{w.authors.join(", ")}</span>
        </button>
      ))}
    </div>
  );
}
