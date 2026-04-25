"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { WorkDto, AnnotationDto } from "@/lib/types";

type Tab = "corpus" | "trail" | "annotations";
type GraphNode = d3.SimulationNodeDatum & WorkDto;
type GraphLink = d3.SimulationLinkDatum<GraphNode> & { source: string | GraphNode; target: string | GraphNode };

type PassageDto = { id: string; passageIndex: number; text: string; sectionKey: string };

type ReaderData = {
  id: string;
  work: { id: string; title: string; authors: string[] };
  passages: PassageDto[];
  annotations: AnnotationDto[];
  totalPassages: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 60;
const DEMO_USERS = ["alice", "bob", "demo-user"] as const;
type DemoUser = (typeof DEMO_USERS)[number];

export function ReadingBoxApp() {
  const [tab, setTab] = useState<Tab>("corpus");
  const [works, setWorks] = useState<WorkDto[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [reader, setReader] = useState<ReaderData | null>(null);
  const [readerPage, setReaderPage] = useState(1);
  const [readerLoading, setReaderLoading] = useState(false);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [annotationBody, setAnnotationBody] = useState("");
  const [selection, setSelection] = useState<{ start: number; end: number; exact: string } | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [globalReplyDrafts, setGlobalReplyDrafts] = useState<Record<string, string>>({});
  const [globalAnnotations, setGlobalAnnotations] = useState<Array<Record<string, unknown>>>([]);
  const [trail, setTrail] = useState<Array<Record<string, unknown>>>([]);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeUser, setActiveUser] = useState<DemoUser>("alice");
  const graphRef = useRef<SVGSVGElement | null>(null);
  const graphNodeSelectionRef =
    useRef<d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null>(null);
  const passageRefs = useRef<Record<string, HTMLParagraphElement | null>>({});
  const readerScrollRef = useRef<HTMLDivElement | null>(null);
  // track if we've done the initial scroll resume for this reader load
  const didResumeRef = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    void fetch("/api/works")
      .then((r) => r.json())
      .then((json: WorkDto[]) => setWorks(json));
    void refreshAnnotations();
    void refreshTrail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh trail when activeUser changes
  useEffect(() => {
    void refreshTrail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser]);

  const fetchReaderPage = useCallback(async (editionId: string, page: number) => {
    setReaderLoading(true);
    try {
      const data = await fetchReaderApi(editionId, page, PAGE_SIZE);
      setReader(data);
      setReaderPage(page);
    } finally {
      setReaderLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedWorkId) return;
    const work = works.find((w) => w.id === selectedWorkId);
    if (!work?.editionId) return;
    didResumeRef.current = false;
    void fetchReaderPage(work.editionId, 1);
    void fetch("/api/trail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: activeUser,
        workId: work.id,
        editionId: work.editionId,
        eventType: "OPEN_WORK",
        visibility: "PUBLIC",
      }),
    }).then(() => refreshTrail());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkId, works]);

  const graphEdges = useMemo(() => {
    return works.flatMap((w) =>
      w.references.map((r) => ({ source: w.id, target: r.targetWorkId, relation: r.relation })),
    );
  }, [works]);

  useEffect(() => {
    if (viewMode !== "graph" || !graphRef.current || works.length === 0) return;
    const svg = d3.select(graphRef.current);
    const width = 420;
    const height = 380;
    svg.selectAll("*").remove();
    const root = svg.append("g");
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 3])
        .on("zoom", (event) => root.attr("transform", event.transform.toString())),
    );

    const nodes: GraphNode[] = works.map((w) => ({ ...w }));
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: GraphLink[] = graphEdges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance(90),
      )
      .force("charge", d3.forceManyBody().strength(-260))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(20));

    // Arrow marker
    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -4 8 8")
      .attr("refX", 16)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L8,0L0,4")
      .attr("fill", "#45413a");

    const link = root
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", "#45413a")
      .attr("stroke-width", 1.2)
      .attr("marker-end", "url(#arrow)");

    const node = root
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", 9)
      .attr("fill", "#8c877f")
      .style("cursor", "pointer")
      .call(
        d3
          .drag<SVGCircleElement, GraphNode>()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }),
      )
      .on("click", (_, d) => setSelectedWorkId(d.id));
    graphNodeSelectionRef.current = node;

    const labels = root
      .append("g")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("font-size", 10)
      .attr("fill", "#b9b5ad")
      .attr("text-anchor", "middle")
      .text((d) => d.title.slice(0, 18));

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => ("x" in d.source ? d.source.x ?? 0 : 0))
        .attr("y1", (d) => ("y" in d.source ? d.source.y ?? 0 : 0))
        .attr("x2", (d) => ("x" in d.target ? d.target.x ?? 0 : 0))
        .attr("y2", (d) => ("y" in d.target ? d.target.y ?? 0 : 0));
      node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
      labels.attr("x", (d) => d.x ?? 0).attr("y", (d) => (d.y ?? 0) + 22);
    });

    return () => {
      simulation.stop();
      graphNodeSelectionRef.current = null;
    };
  }, [works, graphEdges, viewMode]);

  useEffect(() => {
    if (!graphNodeSelectionRef.current) return;
    graphNodeSelectionRef.current
      .attr("r", (d) => (selectedWorkId === d.id ? 12 : 9))
      .attr("fill", (d) => (selectedWorkId === d.id ? "#b5935a" : "#8c877f"));
  }, [selectedWorkId]);

  // Trail-based scroll resume — runs after reader AND passages are mounted
  useEffect(() => {
    if (!reader || reader.passages.length === 0 || didResumeRef.current) return;
    const lastPassageEvent = [...trail]
      .reverse()
      .find(
        (event) =>
          String(event.editionId ?? "") === reader.id &&
          typeof event.passageId === "string" &&
          event.passageId.length > 0,
      );
    if (!lastPassageEvent) return;
    const passageId = String(lastPassageEvent.passageId);
    // Defer until after the browser has painted the passage list
    requestAnimationFrame(() => {
      const target = passageRefs.current[passageId];
      if (!target) return;
      didResumeRef.current = true;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [reader, trail]);

  async function submitAnnotation() {
    if (!reader || !selectedPassageId || !selection || !annotationBody.trim()) return;
    await fetch("/api/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        editionId: reader.id,
        passageId: selectedPassageId,
        userName: activeUser,
        startOffset: selection.start,
        endOffset: selection.end,
        body: annotationBody.trim(),
      }),
    });
    await postTrailEvent({
      workId: reader.work.id,
      editionId: reader.id,
      passageId: selectedPassageId,
      eventType: "ANNOTATE",
    });
    setAnnotationBody("");
    setSelection(null);
    setReader(await fetchReaderApi(reader.id, readerPage, PAGE_SIZE));
    await refreshAnnotations();
  }

  async function deleteAnnotation(id: string) {
    await fetch(`/api/annotations?id=${id}`, { method: "DELETE" });
    if (reader) setReader(await fetchReaderApi(reader.id, readerPage, PAGE_SIZE));
    await refreshAnnotations();
  }

  // Render a passage paragraph with stored annotation highlights overlaid
  function renderPassageText(p: PassageDto) {
    const passageAnnotations = reader?.annotations.filter((a) => a.passageId === p.id) ?? [];
    // Current in-progress selection highlight takes priority
    if (selectedPassageId === p.id && selection) {
      return (
        <>
          {p.text.slice(0, selection.start)}
          <mark className="mark-new">{p.text.slice(selection.start, selection.end)}</mark>
          {p.text.slice(selection.end)}
        </>
      );
    }
    if (passageAnnotations.length === 0) return <>{p.text}</>;
    // Build non-overlapping highlight spans from annotation offsets
    // Sort by startOffset, take first occurrence of any overlap
    const sorted = [...passageAnnotations].sort((a, b) => a.startOffset - b.startOffset);
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    for (const ann of sorted) {
      const start = Math.max(cursor, ann.startOffset);
      const end = Math.min(p.text.length, ann.endOffset);
      if (start >= end) continue;
      if (start > cursor) parts.push(p.text.slice(cursor, start));
      parts.push(
        <mark
          key={ann.id}
          className={`mark-existing mark-state-${ann.state.toLowerCase()}`}
          title={`${ann.userName}: ${ann.body.slice(0, 80)}`}
        >
          {p.text.slice(start, end)}
        </mark>,
      );
      cursor = end;
    }
    if (cursor < p.text.length) parts.push(p.text.slice(cursor));
    return <>{parts}</>;
  }

  const totalPages = reader ? Math.ceil(reader.totalPassages / PAGE_SIZE) : 1;

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
            Traces
          </button>
        </nav>
        <div className="topbar-right">
          <div className="user-switcher">
            {DEMO_USERS.map((u) => (
              <button
                key={u}
                className={`user-pill ${activeUser === u ? "active" : ""}`}
                onClick={() => setActiveUser(u)}
                title={`Switch to ${u}`}
              >
                {u}
              </button>
            ))}
          </div>
          <button
            className="theme-toggle"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
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
                  <button key={w.id} onClick={() => setSelectedWorkId(w.id)} className={`work-item ${selectedWorkId === w.id ? "selected" : ""}`}>
                    <strong>{w.title}</strong>
                    <span>{w.authors.join(", ")}</span>
                    {(w.references.length > 0 || w.citedBy.length > 0) && (
                      <span className="work-refs">
                        {w.references.length > 0 && `→ ${w.references.length} ref`}
                        {w.citedBy.length > 0 && ` · cited ${w.citedBy.length}×`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <svg ref={graphRef} viewBox="0 0 420 380" className="graph" />
            )}
          </aside>

          <section className="reader" ref={readerScrollRef}>
            {readerLoading && (
              <div className="reader-loading">
                <div className="skeleton skeleton-heading" />
                <div className="skeleton skeleton-text" />
                <div className="skeleton skeleton-text" />
                <div className="skeleton skeleton-text" style={{ width: "60%" }} />
                <div className="skeleton skeleton-text" style={{ marginTop: "20px" }} />
                <div className="skeleton skeleton-text" />
                <div className="skeleton skeleton-text" style={{ width: "75%" }} />
              </div>
            )}
            {!reader && !readerLoading ? (
              <div className="empty">Select a work from the corpus to begin reading.</div>
            ) : reader && !readerLoading ? (
              <>
                <h1>{reader.work.title}</h1>
                <p className="authors">{reader.work.authors.join(", ")}</p>

                {totalPages > 1 && (
                  <div className="page-nav">
                    <button
                      disabled={readerPage <= 1}
                      onClick={() => void fetchReaderPage(reader.id, readerPage - 1)}
                    >
                      ← Prev
                    </button>
                    <span>
                      Page {readerPage} of {totalPages}{" "}
                      <span className="page-count">({reader.totalPassages} passages total)</span>
                    </span>
                    <button
                      disabled={readerPage >= totalPages}
                      onClick={() => void fetchReaderPage(reader.id, readerPage + 1)}
                    >
                      Next →
                    </button>
                  </div>
                )}

                <div className="passages">
                  {reader.passages.length === 0 ? (
                    <p className="passages-empty">
                      No passages found for this edition. Re-run the seed script.
                    </p>
                  ) : (
                    reader.passages.map((p, idx) => (
                      <article key={p.id}>
                        {(idx === 0 || reader.passages[idx - 1]?.sectionKey !== p.sectionKey) && (
                          <h3 className="section-heading">{p.sectionKey}</h3>
                        )}
                        <p
                          ref={(el) => { passageRefs.current[p.id] = el; }}
                          data-passage-id={p.id}
                          className={selectedPassageId === p.id ? "passage-selected" : ""}
                          onMouseUp={(event) => {
                            const el = event.currentTarget;
                            const resolved = resolveSelectionOffsets(el);
                            if (!resolved) return;
                            setSelectedPassageId(p.id);
                            setSelection(resolved);
                            if (reader) {
                              void postTrailEvent({
                                workId: reader.work.id,
                                editionId: reader.id,
                                passageId: p.id,
                                eventType: "OPEN_PASSAGE",
                              }).then(() => refreshTrail());
                            }
                          }}
                        >
                          {renderPassageText(p)}
                        </p>
                        {selectedPassageId === p.id && selection && (
                          <div className="compose-inline">
                            <div className="compose-quote">&quot;{selection.exact}&quot;</div>
                            <textarea
                              value={annotationBody}
                              placeholder="Open a thread on this selected passage..."
                              onChange={(e) => setAnnotationBody(e.target.value)}
                            />
                            <div className="compose-actions">
                              <button onClick={() => void submitAnnotation()}>Create annotation</button>
                              <button className="btn-cancel" onClick={() => { setSelection(null); setSelectedPassageId(null); }}>Cancel</button>
                            </div>
                          </div>
                        )}
                        {reader.annotations
                          .filter((a) => a.passageId === p.id)
                          .map((a) => (
                            <div key={a.id} className={`annotation annotation-${a.state.toLowerCase()}`}>
                              <div className="annotation-head">
                                <b>{a.userName}</b>
                                <span className={`thread-state thread-${a.state.toLowerCase()}`}>{a.state}</span>
                                {a.state === "OPEN" && (
                                  <button
                                    className="btn-inline"
                                    onClick={async () => {
                                      await fetch("/api/annotations", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "close", id: a.id }),
                                      });
                                      setReader(await fetchReaderApi(reader.id, readerPage, PAGE_SIZE));
                                      await refreshAnnotations();
                                    }}
                                  >
                                    close
                                  </button>
                                )}
                                {a.userName === activeUser && (
                                  <button
                                    className="btn-inline btn-delete"
                                    onClick={() => void deleteAnnotation(a.id)}
                                    title="Delete thread"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                              <div className="annotation-exact">&ldquo;{a.exact}&rdquo;</div>
                              <div className="annotation-body">{a.body}</div>
                              {a.replies.map((r) => (
                                <div className="reply" key={r.id}>
                                  <span className="reply-user">{r.userName}</span>
                                  {r.body}
                                </div>
                              ))}
                              {a.state === "OPEN" && (
                                <div className="reply-compose">
                                  <input
                                    value={replyDrafts[a.id] ?? ""}
                                    placeholder="Reply in thread..."
                                    onChange={(e) =>
                                      setReplyDrafts((prev) => ({ ...prev, [a.id]: e.target.value }))
                                    }
                                  />
                                  <button
                                    onClick={async () => {
                                      const body = (replyDrafts[a.id] ?? "").trim();
                                      if (!body) return;
                                      await fetch("/api/annotations", {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ parentId: a.id, userName: activeUser, body }),
                                      });
                                      await postTrailEvent({
                                        workId: reader.work.id,
                                        editionId: reader.id,
                                        passageId: a.passageId,
                                        eventType: "REPLY",
                                      });
                                      setReplyDrafts((prev) => ({ ...prev, [a.id]: "" }));
                                      setReader(await fetchReaderApi(reader.id, readerPage, PAGE_SIZE));
                                      await refreshAnnotations();
                                    }}
                                  >
                                    reply
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                      </article>
                    ))
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="page-nav page-nav-bottom">
                    <button
                      disabled={readerPage <= 1}
                      onClick={() => { void fetchReaderPage(reader.id, readerPage - 1); readerScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      ← Prev
                    </button>
                    <span>Page {readerPage} of {totalPages}</span>
                    <button
                      disabled={readerPage >= totalPages}
                      onClick={() => { void fetchReaderPage(reader.id, readerPage + 1); readerScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }); }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </section>

          <aside className="context-panel">
            <h3>Context Map</h3>
            {selectedWorkId ? (
              <>
                <div className="context-group">
                  <h4>References</h4>
                  {(works.find((w) => w.id === selectedWorkId)?.references ?? []).length === 0 ? (
                    <p className="context-empty">No outgoing references.</p>
                  ) : (
                    (works.find((w) => w.id === selectedWorkId)?.references ?? []).map((r) => (
                      <button key={r.targetWorkId} className="context-ref" onClick={() => setSelectedWorkId(r.targetWorkId)}>
                        <span className="ref-title">{r.targetTitle}</span>
                        <span className="ref-relation">{r.relation}</span>
                      </button>
                    ))
                  )}
                </div>
                <div className="context-group">
                  <h4>Cited by</h4>
                  {(works.find((w) => w.id === selectedWorkId)?.citedBy ?? []).length === 0 ? (
                    <p className="context-empty">Not cited by other works in corpus.</p>
                  ) : (
                    (works.find((w) => w.id === selectedWorkId)?.citedBy ?? []).map((r) => (
                      <button key={r.sourceWorkId} className="context-ref" onClick={() => setSelectedWorkId(r.sourceWorkId)}>
                        <span className="ref-title">{r.sourceTitle}</span>
                        <span className="ref-relation">{r.relation}</span>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="context-empty">Select a work to view its reference neighborhood.</p>
            )}
          </aside>
        </main>
      )}

      {tab === "trail" && (
        <main className="trail">
          <div className="trail-header">
            <h2>Trail · <span className="trail-user">{activeUser}</span></h2>
            <p className="trail-hint">Switch users in the header to compare reading paths.</p>
          </div>
          {trail.length === 0 ? (
            <p className="passages-empty">No trail yet — open a work to begin.</p>
          ) : (
            <div className="trail-timeline">
              {trail.map((event, idx) => {
                const eventType = String(event.eventType ?? "");
                const workTitle = (event.work as { title?: string })?.title ?? "Unknown work";
                const passageText = (event.passage as { text?: string })?.text;
                const icon =
                  eventType === "OPEN_WORK" ? "📖"
                  : eventType === "OPEN_PASSAGE" ? "¶"
                  : eventType === "ANNOTATE" ? "✎"
                  : eventType === "REPLY" ? "↩"
                  : "·";
                return (
                  <div key={idx} className={`trail-event trail-event-${eventType.toLowerCase().replace(/_/g, "-")}`}>
                    <div className="trail-event-icon">{icon}</div>
                    <div className="trail-event-body">
                      <button
                        className="trail-event-title"
                        onClick={() => {
                          const workId = String(event.workId ?? "");
                          if (!workId) return;
                          setTab("corpus");
                          setSelectedWorkId(workId);
                        }}
                      >
                        {workTitle}
                      </button>
                      <span className="trail-event-type">{eventType.replace(/_/g, " ").toLowerCase()}</span>
                      {passageText && (
                        <p className="trail-event-passage">
                          &ldquo;{passageText.slice(0, 80)}&hellip;&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      )}

      {tab === "annotations" && (
        <main className="annotations">
          <div className="annotations-header">
            <h2>Traces</h2>
            <p className="trail-hint">Sorted by attention — threads with the most replies first.</p>
          </div>
          {globalAnnotations.length === 0 ? (
            <p className="passages-empty">No traces yet — highlight a passage to start a thread.</p>
          ) : (
            <div className="annotations-list">
              {globalAnnotations.map((a, idx) => (
                <div className={`annotation-card annotation-card-${String(a.state ?? "").toLowerCase()}`} key={idx}>
                  <div className="annotation-card-head">
                    <strong>{String(a.userName ?? "")}</strong>
                    <span className={`thread-state thread-${String(a.state ?? "").toLowerCase()}`}>{String(a.state ?? "")}</span>
                    <button
                      className="btn-jump"
                      onClick={() => {
                        const workId = String(a.workId ?? "");
                        if (!workId) return;
                        setTab("corpus");
                        setSelectedWorkId(workId);
                      }}
                    >
                      Jump to text →
                    </button>
                  </div>
                  {a.exact && (
                    <div className="annotation-exact">&ldquo;{String(a.exact)}&rdquo;</div>
                  )}
                  <div className="annotation-body">{String(a.body ?? "")}</div>
                  <div className="annotation-meta">
                    {Array.isArray(a.replies) ? a.replies.length : 0} repl{Array.isArray(a.replies) && a.replies.length === 1 ? "y" : "ies"}
                  </div>
                  {String(a.state ?? "") === "OPEN" && (
                    <div className="reply-compose">
                      <input
                        value={globalReplyDrafts[String(a.id ?? "")] ?? ""}
                        placeholder="Reply from Traces view..."
                        onChange={(e) =>
                          setGlobalReplyDrafts((prev) => ({
                            ...prev,
                            [String(a.id ?? "")]: e.target.value,
                          }))
                        }
                      />
                      <button
                        onClick={async () => {
                          const id = String(a.id ?? "");
                          const body = (globalReplyDrafts[id] ?? "").trim();
                          if (!id || !body) return;
                          await fetch("/api/annotations", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ parentId: id, userName: activeUser, body }),
                          });
                          const workId = String(a.workId ?? "");
                          const editionId = String(a.editionId ?? "");
                          const passageId = String(a.passageId ?? "");
                          await postTrailEvent({ workId, editionId, passageId, eventType: "REPLY" });
                          setGlobalReplyDrafts((prev) => ({ ...prev, [id]: "" }));
                          await refreshAnnotations();
                          if (reader) setReader(await fetchReaderApi(reader.id, readerPage, PAGE_SIZE));
                        }}
                      >
                        reply
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      )}
    </div>
  );

  async function refreshAnnotations() {
    const json = (await fetch("/api/annotations").then((r) => r.json())) as Array<Record<string, unknown>>;
    setGlobalAnnotations(json);
  }

  async function refreshTrail() {
    const json = (await fetch(`/api/trail?userId=${activeUser}`).then((r) => r.json())) as Array<Record<string, unknown>>;
    setTrail(json);
  }

  async function postTrailEvent(input: {
    workId: string;
    editionId: string;
    passageId?: string;
    eventType: "OPEN_WORK" | "OPEN_PASSAGE" | "ANNOTATE" | "REPLY";
  }) {
    if (!input.workId || !input.editionId) return;
    await fetch("/api/trail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: activeUser,
        workId: input.workId,
        editionId: input.editionId,
        passageId: input.passageId ?? null,
        eventType: input.eventType,
        visibility: "PUBLIC",
      }),
    });
  }
}

function resolveSelectionOffsets(
  container: HTMLElement,
): { start: number; end: number; exact: string } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const exact = range.toString().trim();
  if (!exact) return null;
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;
  const start = getTextOffsetWithTreeWalker(container, range.startContainer, range.startOffset);
  if (start < 0) return null;
  return { start, end: start + exact.length, exact };
}

function getTextOffsetWithTreeWalker(
  container: HTMLElement,
  targetNode: Node,
  targetOffset: number,
): number {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let count = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node === targetNode) return count + targetOffset;
    count += node.textContent?.length ?? 0;
  }
  return -1;
}

async function fetchReaderApi(editionId: string, page: number, pageSize: number) {
  return (await fetch(`/api/reader/${editionId}?page=${page}&pageSize=${pageSize}`).then((r) => r.json())) as {
    id: string;
    work: { id: string; title: string; authors: string[] };
    passages: Array<{ id: string; passageIndex: number; text: string; sectionKey: string }>;
    annotations: AnnotationDto[];
    totalPassages: number;
    page: number;
    pageSize: number;
  };
}
