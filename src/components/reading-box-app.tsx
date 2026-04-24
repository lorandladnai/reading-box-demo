"use client";

import * as d3 from "d3";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkDto } from "@/lib/types";

type Tab = "corpus" | "trail" | "annotations";
type ReaderData = Awaited<ReturnType<typeof fetchReader>>;
type GraphNode = d3.SimulationNodeDatum & WorkDto;
type GraphLink = d3.SimulationLinkDatum<GraphNode> & { source: string | GraphNode; target: string | GraphNode };

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
  const graphRef = useRef<SVGSVGElement | null>(null);

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
      .attr("r", (d) => (selectedWorkId === d.id ? 12 : 9))
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
      .on("click", (_, d) => setSelectedWorkId(d.id));

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
    };
  }, [works, graphEdges, viewMode, selectedWorkId]);

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
              <svg ref={graphRef} viewBox="0 0 420 380" className="graph" />
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
                  {reader.passages.map((p, idx) => (
                    <article key={p.id}>
                      {(idx === 0 || reader.passages[idx - 1]?.sectionKey !== p.sectionKey) && (
                        <h3 className="section-heading">{p.sectionKey}</h3>
                      )}
                      <p
                        onMouseUp={(event) => {
                          const el = event.currentTarget;
                          const selected = window.getSelection()?.toString() ?? "";
                          if (!selected.trim()) return;
                          const start = el.textContent?.indexOf(selected) ?? -1;
                          if (start < 0) return;
                          setSelectedPassageId(p.id);
                          setSelection({ start, end: start + selected.length, exact: selected });
                        }}
                      >
                        {selectedPassageId === p.id && selection
                          ? `${p.text.slice(0, selection.start)}`
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
                  ))}
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
                  {(works.find((w) => w.id === selectedWorkId)?.references ?? []).map((r) => (
                    <button key={r.targetWorkId} onClick={() => setSelectedWorkId(r.targetWorkId)}>
                      {r.targetTitle}
                    </button>
                  ))}
                </div>
                <div className="context-group">
                  <h4>Cited by</h4>
                  {(works.find((w) => w.id === selectedWorkId)?.citedBy ?? []).map((r) => (
                    <button key={r.sourceWorkId} onClick={() => setSelectedWorkId(r.sourceWorkId)}>
                      {r.sourceTitle}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p>Select a work to view its local reference neighborhood.</p>
            )}
          </aside>
        </main>
      )}

      {tab === "trail" && (
        <main className="trail">
          <h2>My Trail</h2>
          {trail.map((event, idx) => (
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
              {(event.work as { title?: string })?.title ?? "Unknown work"} ·{" "}
              {String(event.eventType ?? "")}
            </button>
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
              {String(a.state ?? "") === "OPEN" && (
                <div className="reply-compose">
                  <input
                    value={globalReplyDrafts[String(a.id ?? "")] ?? ""}
                    placeholder="Reply from global view..."
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
