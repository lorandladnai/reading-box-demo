"use client";

import { useEffect, useMemo, useState } from "react";
import type { WorkDto } from "@/lib/types";

type Tab = "corpus" | "trail" | "annotations";
type ReaderData = Awaited<ReturnType<typeof fetchReader>>;

export function ReadingBoxApp() {
  const [tab, setTab] = useState<Tab>("corpus");
  const [works, setWorks] = useState<WorkDto[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [reader, setReader] = useState<ReaderData | null>(null);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [annotationBody, setAnnotationBody] = useState("");
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [globalAnnotations, setGlobalAnnotations] = useState<Array<Record<string, unknown>>>([]);
  const [trail, setTrail] = useState<Array<Record<string, unknown>>>([]);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  useEffect(() => {
    void fetch("/api/works")
      .then((r) => r.json())
      .then((json: WorkDto[]) => setWorks(json));
    void refreshAnnotations();
    void refreshTrail();
  }, []);

  useEffect(() => {
    if (!selectedWorkId) return;
    const work = works.find((w) => w.id === selectedWorkId);
    if (!work?.editionId) return;
    void fetchReader(work.editionId).then(setReader);
    void fetch("/api/trail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "demo-user",
        workId: work.id,
        editionId: work.editionId,
        eventType: "OPEN_WORK",
        visibility: "PUBLIC",
      }),
    }).then(() => refreshTrail());
  }, [selectedWorkId, works]);

  const graphEdges = useMemo(() => {
    return works.flatMap((w) =>
      w.references.map((r) => ({ source: w.id, target: r.targetWorkId, relation: r.relation })),
    );
  }, [works]);

  async function submitAnnotation() {
    if (!reader || !selectedPassageId || !selection || !annotationBody.trim()) return;
    await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        editionId: reader.id,
        passageId: selectedPassageId,
        userName: "demo-user",
        startOffset: selection.start,
        endOffset: selection.end,
        body: annotationBody.trim(),
      }),
    });
    setAnnotationBody("");
    setSelection(null);
    setReader(await fetchReader(reader.id));
    await refreshAnnotations();
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">Reading Box</div>
        <nav className="tabs">
          <button className={tab === "corpus" ? "active" : ""} onClick={() => setTab("corpus")}>
            Corpus
          </button>
          <button className={tab === "trail" ? "active" : ""} onClick={() => setTab("trail")}>
            My Trail
          </button>
          <button
            className={tab === "annotations" ? "active" : ""}
            onClick={() => setTab("annotations")}
          >
            Annotations
          </button>
        </nav>
      </header>

      {tab === "corpus" && (
        <main className="layout">
          <aside className="left">
            <div className="left-head">
              <h3>Corpus</h3>
              <div>
                <button onClick={() => setViewMode("graph")}>Graph</button>
                <button onClick={() => setViewMode("list")}>List</button>
              </div>
            </div>
            {viewMode === "list" ? (
              <div className="list">
                {works.map((w) => (
                  <button key={w.id} onClick={() => setSelectedWorkId(w.id)} className="work-item">
                    <strong>{w.title}</strong>
                    <span>{w.authors.join(", ")}</span>
                  </button>
                ))}
              </div>
            ) : (
              <svg viewBox="0 0 420 380" className="graph">
                {graphEdges.map((e, i) => {
                  const si = works.findIndex((x) => x.id === e.source);
                  const ti = works.findIndex((x) => x.id === e.target);
                  const sx = 60 + (si % 3) * 130;
                  const sy = 80 + Math.floor(si / 3) * 120;
                  const tx = 60 + (ti % 3) * 130;
                  const ty = 80 + Math.floor(ti / 3) * 120;
                  return <line key={i} x1={sx} y1={sy} x2={tx} y2={ty} stroke="#555" />;
                })}
                {works.map((w, idx) => {
                  const x = 60 + (idx % 3) * 130;
                  const y = 80 + Math.floor(idx / 3) * 120;
                  return (
                    <g key={w.id} onClick={() => setSelectedWorkId(w.id)}>
                      <circle cx={x} cy={y} r={14} fill={selectedWorkId === w.id ? "#b5935a" : "#888"} />
                      <text x={x} y={y + 28} textAnchor="middle" fontSize={10} fill="#c8c6c2">
                        {w.title.slice(0, 16)}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </aside>
          <section className="reader">
            {!reader ? (
              <div className="empty">Válassz művet a corpusból.</div>
            ) : (
              <>
                <h1>{reader.work.title}</h1>
                <p className="authors">{reader.work.authors.join(", ")}</p>
                <div className="passages">
                  {reader.passages.map((p) => (
                    <article key={p.id}>
                      <p
                        onMouseUp={(event) => {
                          const el = event.currentTarget;
                          const selected = window.getSelection()?.toString() ?? "";
                          if (!selected.trim()) return;
                          const start = el.textContent?.indexOf(selected) ?? -1;
                          if (start < 0) return;
                          setSelectedPassageId(p.id);
                          setSelection({ start, end: start + selected.length });
                        }}
                      >
                        {p.text}
                      </p>
                      {reader.annotations
                        .filter((a) => a.passageId === p.id)
                        .map((a) => (
                          <div key={a.id} className="annotation">
                            <div className="annotation-head">
                              <b>{a.userName}</b> · {a.state}
                              {a.state === "OPEN" && (
                                <button
                                  onClick={async () => {
                                    await fetch("/api/annotations", {
                                      method: "PATCH",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ action: "close", id: a.id }),
                                    });
                                    setReader(await fetchReader(reader.id));
                                    await refreshAnnotations();
                                  }}
                                >
                                  close
                                </button>
                              )}
                            </div>
                            <div>{a.body}</div>
                            {a.replies.map((r) => (
                              <div className="reply" key={r.id}>
                                {r.userName}: {r.body}
                              </div>
                            ))}
                          </div>
                        ))}
                    </article>
                  ))}
                </div>
                <div className="compose">
                  <textarea
                    value={annotationBody}
                    placeholder="Leave a trace..."
                    onChange={(e) => setAnnotationBody(e.target.value)}
                  />
                  <button onClick={() => void submitAnnotation()}>Create annotation</button>
                </div>
              </>
            )}
          </section>
        </main>
      )}

      {tab === "trail" && (
        <main className="trail">
          <h2>My Trail</h2>
          {trail.map((event, idx) => (
            <div key={idx} className="trail-item">
              {(event.work as { title?: string })?.title ?? "Unknown work"} ·{" "}
              {String(event.eventType ?? "")}
            </div>
          ))}
        </main>
      )}

      {tab === "annotations" && (
        <main className="annotations">
          <h2>Global Annotations</h2>
          {globalAnnotations.map((a, idx) => (
            <div className="annotation-card" key={idx}>
              <div>
                <strong>{String(a.userName ?? "")}</strong> · {String(a.state ?? "")}
              </div>
              <div>{String(a.body ?? "")}</div>
              <div>replies: {Array.isArray(a.replies) ? a.replies.length : 0}</div>
            </div>
          ))}
        </main>
      )}
    </div>
  );

  async function refreshAnnotations() {
    const json = (await fetch("/api/annotations").then((r) => r.json())) as Array<Record<string, unknown>>;
    setGlobalAnnotations(json);
  }

  async function refreshTrail() {
    const json = (await fetch("/api/trail?userId=demo-user").then((r) => r.json())) as Array<
      Record<string, unknown>
    >;
    setTrail(json);
  }
}

async function fetchReader(editionId: string) {
  return (await fetch(`/api/reader/${editionId}`).then((r) => r.json())) as {
    id: string;
    work: { id: string; title: string; authors: string[] };
    passages: Array<{ id: string; passageIndex: number; text: string; sectionKey: string }>;
    annotations: Array<{
      id: string;
      body: string;
      state: "OPEN" | "CLOSED";
      passageId: string;
      userName: string;
      replies: Array<{ id: string; body: string; userName: string }>;
    }>;
  };
}
