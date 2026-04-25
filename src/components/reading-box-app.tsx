"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkDto, ReaderDto, AnnotationDto, TrailEventDto, SelectionState } from "@/lib/types";
import { CorpusGraph } from "./CorpusGraph";
import { CorpusList } from "./CorpusList";
import { PassageReader } from "./PassageReader";
import { ContextPanel } from "./ContextPanel";
import { TrailFeed } from "./TrailFeed";
import { AnnotationsFeed } from "./AnnotationsFeed";

type Tab = "corpus" | "trail" | "annotations";

export function ReadingBoxApp() {
  const [tab, setTab] = useState<Tab>("corpus");
  const [works, setWorks] = useState<WorkDto[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string | null>(null);
  const [reader, setReader] = useState<ReaderDto | null>(null);
  const [selectedPassageId, setSelectedPassageId] = useState<string | null>(null);
  const [annotationBody, setAnnotationBody] = useState("");
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [globalReplyDrafts, setGlobalReplyDrafts] = useState<Record<string, string>>({});
  const [globalAnnotations, setGlobalAnnotations] = useState<AnnotationDto[]>([]);
  const [trail, setTrail] = useState<TrailEventDto[]>([]);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const passageRefs = useRef<Record<string, HTMLParagraphElement | null>>({});

  // Sync theme onto <html> so CSS vars respond
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

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

  // Unused but keep useMemo for future graph edge use
  const _graphEdges = useMemo(
    () =>
      works.flatMap((w) =>
        w.references.map((r) => ({ source: w.id, target: r.targetWorkId, relation: r.relation }))
      ),
    [works]
  );
  void _graphEdges;

  // Scroll to last visited passage when reader loads
  useEffect(() => {
    if (!reader) return;
    const lastPassageEvent = [...trail]
      .reverse()
      .find(
        (event) =>
          event.editionId === reader.id &&
          typeof event.passageId === "string" &&
          event.passageId.length > 0,
      );
    if (!lastPassageEvent?.passageId) return;
    const target = passageRefs.current[lastPassageEvent.passageId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [reader, trail, selectedWorkId]);

  // ── Handlers ──────────────────────────────────────────────────

  function handlePassageMouseUp(passageId: string, resolved: SelectionState | null) {
    if (!resolved) return;
    setSelectedPassageId(passageId);
    setSelection(resolved);
    if (reader) {
      void postTrailEvent({
        workId: reader.work.id,
        editionId: reader.id,
        passageId,
        eventType: "OPEN_PASSAGE",
      }).then(() => refreshTrail());
    }
  }

  async function handleSubmitAnnotation() {
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

  async function handleCloseAnnotation(id: string) {
    await fetch("/api/annotations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", id }),
    });
    if (reader) setReader(await fetchReader(reader.id));
    await refreshAnnotations();
  }

  async function handleSubmitReply(annotationId: string) {
    const body = (replyDrafts[annotationId] ?? "").trim();
    if (!body || !reader) return;
    await fetch("/api/annotations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: annotationId, userName: "demo-user", body }),
    });
    const annotation = reader.annotations.find((a) => a.id === annotationId);
    if (annotation) {
      await postTrailEvent({
        workId: reader.work.id,
        editionId: reader.id,
        passageId: annotation.passageId,
        eventType: "REPLY",
      });
    }
    setReplyDrafts((prev) => ({ ...prev, [annotationId]: "" }));
    setReader(await fetchReader(reader.id));
    await refreshAnnotations();
  }

  async function handleSubmitGlobalReply(annotationId: string) {
    const body = (globalReplyDrafts[annotationId] ?? "").trim();
    if (!body) return;
    await fetch("/api/annotations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: annotationId, userName: "demo-user", body }),
    });
    const annotation = globalAnnotations.find((a) => a.id === annotationId);
    if (annotation) {
      await postTrailEvent({
        workId: annotation.workId,
        editionId: annotation.editionId,
        passageId: annotation.passageId,
        eventType: "REPLY",
      });
    }
    setGlobalReplyDrafts((prev) => ({ ...prev, [annotationId]: "" }));
    await refreshAnnotations();
    if (reader) setReader(await fetchReader(reader.id));
  }

  function handleSelectWork(workId: string) {
    setSelectedWorkId(workId);
    setTab("corpus");
  }

  // ── Render ─────────────────────────────────────────────────────

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
              <CorpusList works={works} onSelect={setSelectedWorkId} />
            ) : (
              <CorpusGraph
                works={works}
                selectedWorkId={selectedWorkId}
                onSelect={setSelectedWorkId}
              />
            )}
          </aside>

          <PassageReader
            reader={reader}
            selectedPassageId={selectedPassageId}
            selection={selection}
            annotationBody={annotationBody}
            replyDrafts={replyDrafts}
            passageRefs={passageRefs}
            onPassageMouseUp={handlePassageMouseUp}
            onAnnotationBodyChange={setAnnotationBody}
            onSubmitAnnotation={handleSubmitAnnotation}
            onCloseAnnotation={handleCloseAnnotation}
            onReplyDraftChange={(id, val) =>
              setReplyDrafts((prev) => ({ ...prev, [id]: val }))
            }
            onSubmitReply={handleSubmitReply}
          />

          <ContextPanel
            works={works}
            selectedWorkId={selectedWorkId}
            onSelect={handleSelectWork}
          />
        </main>
      )}

      {tab === "trail" && (
        <TrailFeed trail={trail} onNavigate={handleSelectWork} />
      )}

      {tab === "annotations" && (
        <AnnotationsFeed
          globalAnnotations={globalAnnotations}
          globalReplyDrafts={globalReplyDrafts}
          onReplyDraftChange={(id, val) =>
            setGlobalReplyDrafts((prev) => ({ ...prev, [id]: val }))
          }
          onSubmitGlobalReply={handleSubmitGlobalReply}
        />
      )}
    </div>
  );

  // ── Private helpers ────────────────────────────────────────────

  async function refreshAnnotations() {
    const json = await fetch("/api/annotations").then((r) => r.json()) as AnnotationDto[];
    setGlobalAnnotations(json);
  }

  async function refreshTrail() {
    const json = await fetch("/api/trail?userId=demo-user").then((r) => r.json()) as TrailEventDto[];
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

async function fetchReader(editionId: string): Promise<ReaderDto> {
  return fetch(`/api/reader/${editionId}`).then((r) => r.json()) as Promise<ReaderDto>;
}
