"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { WorkDto } from "@/lib/types";

type Tab = "corpus" | "trail" | "annotations";
type AnnotationScope = "local" | "global";
type ReaderData = Awaited<ReturnType<typeof fetchReader>>;
type GraphNode = d3.SimulationNodeDatum & WorkDto;
type GraphLink = d3.SimulationLinkDatum<GraphNode> & { source: string | GraphNode; target: string | GraphNode };

const EVENT_ICONS: Record<string, string> = {
  OPEN_WORK: "📖",
  OPEN_PASSAGE: "¶",
  ANNOTATE: "✎",
  REPLY: "↩",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function groupByDay(trail: Array<Record<string, unknown>>) {
  const groups: Array<{ day: string; events: Array<Record<string, unknown>> }> = [];
  for (const event of trail) {
    const day = formatDate(String(event.createdAt ?? ""));
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) groups.push({ day, events: [event] });
    else last.events.push(event);
  }
  return groups;
}

export function ReadingBoxApp() {
  const [tab, setTab] = useState<Tab>("corpus");
  const [works, setWorks] = useState<WorkDto[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [reader, setReader] = useState<ReaderData | null>(null);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [annotationBody, setAnnotationBody] = useState("");
  const [selection, setSelection] = useState<{ start: number; end: number; exact: string } | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [globalReplyDrafts, setGlobalReplyDrafts] = useState<Record<string, string>>({});
  const [globalAnnotations, setGlobalAnnotations] = useState<Array<Record<string, unknown>>>([]);
  const [trail, setTrail] = useState<Array<Record<string, unknown>>>([]);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [graphFullscreen, setGraphFullscreen] = useState(false);
  const [annotationScope, setAnnotationScope] = useState<AnnotationScope>("local");
  const graphRef = useRef<SVGSVGElement | null>(null);
  const graphFsRef = useRef<SVGSVGElement | null>(null);
  const graphNodeSelectionRef =
    useRef<d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null>(null);
  const graphNodeFsSelectionRef =
    useRef<d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown> | null>(null);
  const passageRefs = useRef<Record<string, HTMLParagraphElement | null>>({});

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWorkId, works]);

  const graphEdges = useMemo(() => {
    return works.flatMap((w) =>
      w.references.map((r) => ({ source: w.id, target: r.targetWorkId, relation: r.relation })),
    );
  }, [works]);

  const buildGraph = useCallback(
    (svgEl: SVGSVGElement, width: number, height: number, nodeRef: typeof graphNodeSelectionRef) => {
      if (!svgEl || works.length === 0) return () => {};
      const svg = d3.select(svgEl);
      svg.selectAll("*").remove();
      const root = svg.append("g");
      svg.call(
        d3
          .zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.2, 4])
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
            .distance(110),
        )
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide(22));

      const link = root
        .append("g")
        .selectAll("line")
        .data(links)
        .enter()
        .append("line")
        .attr("stroke", "#45413a")
        .attr("stroke-width", 1.2);

      const node = root
        .append("g")
        .selectAll("circle")
        .data(nodes)
        .enter()
        .append("circle")
        .attr("r", 9)
        .attr("fill", (d) => (selectedWorkId === d.id ? "#b5935a" : "#8c877f"))
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
        .on("click", (_, d) => {
          setSelectedWorkId(d.id);
          if (graphFullscreen) setGraphFullscreen(false);
          setTab("corpus");
        });
      nodeRef.current = node;

      const labels = root
        .append("g")
        .selectAll("text")
        .data(nodes)
        .enter()
        .append("text")
        .attr("font-size", 10)
        .attr("fill", "#b9b5ad")
        .attr("text-anchor", "middle")
        .attr("pointer-events", "none")
        .text((d) => d.title.slice(0, 20));

      simulation.on("tick", () => {
        link
          .attr("x1", (d) => ((d.source as unknown as GraphNode).x ?? 0))
          .attr("y1", (d) => ((d.source as unknown as GraphNode).y ?? 0))
          .attr("x2", (d) => ((d.target as unknown as GraphNode).x ?? 0))
          .attr("y2", (d) => ((d.target as unknown as GraphNode).y ?? 0));
        node.attr("cx", (d) => d.x ?? 0).attr("cy", (d) => d.y ?? 0);
        labels.attr("x", (d) => d.x ?? 0).attr("y", (d) => (d.y ?? 0) + 22);
      });

      return () => {
        simulation.stop();
        nodeRef.current = null;
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [works, graphEdges],
  );

  // Sidebar graph
  useEffect(() => {
    if (viewMode !== "graph" || !graphRef.current) return;
    return buildGraph(graphRef.current, 420, 380, graphNodeSelectionRef);
  }, [viewMode, buildGraph]);

  // Fullscreen graph
  useEffect(() => {
    if (!graphFullscreen || !graphFsRef.current) return;
    const w = window.innerWidth;
    const h = window.innerHeight - 64;
    return buildGraph(graphFsRef.current, w, h, graphNodeFsSelectionRef);
  }, [graphFullscreen, buildGraph]);

  // Highlight selected node in sidebar
  useEffect(() => {
    if (!graphNodeSelectionRef.current) return;
    graphNodeSelectionRef.current
      .attr("r", (d) => (selectedWorkId === d.id ? 12 : 9))
      .attr("fill", (d) => (selectedWorkId === d.id ? "#b5935a" : "#8c877f"));
  }, [selectedWorkId]);

  // Highlight selected node in fullscreen
  useEffect(() => {
    if (!graphNodeFsSelectionRef.current) return;
    graphNodeFsSelectionRef.current
      .attr("r", (d) => (selectedWorkId === d.id ? 14 : 9))
      .attr("fill", (d) => (selectedWorkId === d.id ? "#b5935a" : "#8c877f"));
  }, [selectedWorkId]);

  // Restore scroll position from trail
  useEffect(() => {
    if (!reader) return;
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
    const target = passageRefs.current[passageId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [reader, trail, selectedWorkId]);

  // Scope: derive local annotations from reader data
  const localAnnotations = useMemo(() => {
    if (!reader) return [];
    return reader.annotations;
  }, [reader]);

  const visibleAnnotations = annotationScope === "local" ? localAnnotations : globalAnnotations;

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
    await postTrailEvent({
      workId: reader.work.id,
      editionId: reader.id,
      passageId: selectedPassageId,
      eventType: "ANNOTATE",
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
        <button
          className="theme-toggle"
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "☀ Light" : "☾ Dark"}
        </button>
      </header>

      {/* ── GRAPH FULLSCREEN OVERLAY ── */}
      {graphFullscreen && (
        <div className="graph-overlay" role="dialog" aria-label="Corpus graph fullscreen">
          <div className="graph-overlay-bar">
            <span className="graph-overlay-title">Corpus Graph</span>
            <button
              className="graph-overlay-close"
              onClick={() => setGraphFullscreen(false)}
              aria-label="Close fullscreen graph"
            >
              ✕ Close
            </button>
          </div>
          <svg ref={graphFsRef} className="graph-fs" />
        </div>
      )}

      {tab === "corpus" && (
        <main className="layout">
          <aside className="left">
            <div className="left-head">
              <h3>Corpus</h3>
              <div>
                <button
                  className={viewMode === "graph" ? "active" : ""}
                  onClick={() => setViewMode("graph")}
                >
                  Graph
                </button>
                <button
                  className={viewMode === "list" ? "active" : ""}
                  onClick={() => setViewMode("list")}
                >
                  List
                </button>
                {viewMode === "graph" && (
                  <button
                    className="graph-expand-btn"
                    aria-label="Open graph fullscreen"
                    onClick={() => setGraphFullscreen(true)}
                    title="Fullscreen graph"
                  >
                    ⛶
                  </button>
                )}
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
              <svg ref={graphRef} viewBox="0 0 420 380" className="graph" />
            )}
          </aside>

          <section className="reader">
            {!reader ? (
              <div className="empty">Select a work from the corpus to begin reading.</div>
            ) : (
              <>
                <h1>{reader.work.title}</h1>
                <p className="authors">{reader.work.authors.join(", ")}</p>
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
                          {selectedPassageId === p.id && selection
                            ? p.text.slice(0, selection.start)
                            : ""}
                          {selectedPassageId === p.id && selection ? (
                            <>
                              <mark>{p.text.slice(selection.start, selection.end)}</mark>
                              {p.text.slice(selection.end)}
                            </>
                          ) : (
                            p.text
                          )}
                        </p>
                        {selectedPassageId === p.id && selection && (
                          <div className="compose-inline">
                            <div className="compose-quote">&quot;{selection.exact}&quot;</div>
                            <textarea
                              value={annotationBody}
                              placeholder="Open a thread on this selected passage..."
                              onChange={(e) => setAnnotationBody(e.target.value)}
                            />
                            <button onClick={() => void submitAnnotation()}>Create annotation</button>
                          </div>
                        )}
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
                                        body: JSON.stringify({ parentId: a.id, userName: "demo-user", body }),
                                      });
                                      await postTrailEvent({
                                        workId: reader.work.id,
                                        editionId: reader.id,
                                        passageId: a.passageId,
                                        eventType: "REPLY",
                                      });
                                      setReplyDrafts((prev) => ({ ...prev, [a.id]: "" }));
                                      setReader(await fetchReader(reader.id));
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
              </>
            )}
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
                      <button key={r.targetWorkId} onClick={() => setSelectedWorkId(r.targetWorkId)}>
                        {r.targetTitle}
                      </button>
                    ))
                  )}
                </div>
                <div className="context-group">
                  <h4>Cited by</h4>
                  {(works.find((w) => w.id === selectedWorkId)?.citedBy ?? []).length === 0 ? (
                    <p className="context-empty">Not cited by any work in corpus.</p>
                  ) : (
                    (works.find((w) => w.id === selectedWorkId)?.citedBy ?? []).map((r) => (
                      <button key={r.sourceWorkId} onClick={() => setSelectedWorkId(r.sourceWorkId)}>
                        {r.sourceTitle}
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p>Select a work to view its reference neighbourhood.</p>
            )}
          </aside>
        </main>
      )}

      {/* ── MY TRAIL ── */}
      {tab === "trail" && (
        <main className="trail">
          <div className="trail-header">
            <h2>My Trail</h2>
            {trail.length > 0 && (
              <span className="trail-count">{trail.length} events</span>
            )}
          </div>
          {trail.length === 0 ? (
            <div className="trail-empty">
              <div className="trail-empty-icon">📖</div>
              <p>No trail yet — open a work to begin.</p>
            </div>
          ) : (
            groupByDay(trail).map((group) => (
              <div key={group.day} className="trail-day-group">
                <div className="trail-day-label">{group.day}</div>
                {group.events.map((event, idx) => {
                  const workTitle = (event.work as { title?: string })?.title ?? "Unknown work";
                  const eventType = String(event.eventType ?? "");
                  const icon = EVENT_ICONS[eventType] ?? "•";
                  const time = String(event.createdAt ?? "");
                  return (
                    <button
                      key={idx}
                      className="trail-item"
                      onClick={() => {
                        const workId = String(event.workId ?? "");
                        if (!workId) return;
                        setTab("corpus");
                        setSelectedWorkId(workId);
                      }}
                    >
                      <span className="trail-item-icon" aria-hidden="true">{icon}</span>
                      <span className="trail-item-body">
                        <span className="trail-item-title">{workTitle}</span>
                        <span className="trail-item-type">{eventType.replace("_", " ").toLowerCase()}</span>
                      </span>
                      <span className="trail-item-time">{formatTime(time)}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </main>
      )}

      {/* ── ANNOTATIONS ── */}
      {tab === "annotations" && (
        <main className="annotations">
          <div className="annotations-header">
            <h2>Annotations</h2>
            <div className="scope-toggle" role="group" aria-label="Annotation scope">
              <button
                className={annotationScope === "local" ? "active" : ""}
                onClick={() => setAnnotationScope("local")}
                disabled={!reader}
                title={!reader ? "Open a work to see local annotations" : undefined}
              >
                This work
                {reader && localAnnotations.length > 0 && (
                  <span className="scope-badge">{localAnnotations.length}</span>
                )}
              </button>
              <button
                className={annotationScope === "global" ? "active" : ""}
                onClick={() => setAnnotationScope("global")}
              >
                All works
                {globalAnnotations.length > 0 && (
                  <span className="scope-badge">{globalAnnotations.length}</span>
                )}
              </button>
            </div>
          </div>

          {annotationScope === "local" && !reader && (
            <p className="passages-empty">Open a work in the Corpus tab first to see its annotations.</p>
          )}

          {visibleAnnotations.length === 0 ? (
            <p className="passages-empty">No annotations yet — highlight a passage to start a thread.</p>
          ) : (
            (visibleAnnotations as Array<Record<string, unknown>>).map((a, idx) => (
              <div className="annotation-card" key={String(a.id ?? idx)}>
                <div className="annotation-card-head">
                  <b>{String(a.userName ?? "")}</b>
                  <span className={`annotation-state annotation-state--${String(a.state ?? "").toLowerCase()}`}>
                    {String(a.state ?? "").toLowerCase()}
                  </span>
                  {annotationScope === "global" && a.work && (
                    <span className="annotation-work-label">
                      {(a.work as { title?: string }).title ?? ""}
                    </span>
                  )}
                </div>
                <div className="annotation-card-body">{String(a.body ?? "")}</div>
                {Array.isArray(a.replies) && a.replies.length > 0 && (
                  <div className="annotation-replies-count">
                    {a.replies.length} {a.replies.length === 1 ? "reply" : "replies"}
                  </div>
                )}
                {String(a.state ?? "") === "OPEN" && (
                  <div className="reply-compose">
                    <input
                      value={globalReplyDrafts[String(a.id ?? "")] ?? ""}
                      placeholder="Reply..."
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
                          body: JSON.stringify({ parentId: id, userName: "demo-user", body }),
                        });
                        const workId = String(a.workId ?? "");
                        const editionId = String(a.editionId ?? "");
                        const passageId = String(a.passageId ?? "");
                        await postTrailEvent({ workId, editionId, passageId, eventType: "REPLY" });
                        setGlobalReplyDrafts((prev) => ({ ...prev, [id]: "" }));
                        await refreshAnnotations();
                        if (reader) setReader(await fetchReader(reader.id));
                      }}
                    >
                      reply
                    </button>
                  </div>
                )}
              </div>
            ))
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
    const json = (await fetch("/api/trail?userId=demo-user").then((r) => r.json())) as Array<
      Record<string, unknown>
    >;
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
        userId: "demo-user",
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
