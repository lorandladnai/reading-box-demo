"use client";

import { useEffect, useRef, useState } from "react";
import type {
  WorkDto,
  ReaderDto,
  AnnotationDto,
  TrailEventDto,
  SelectionState,
} from "@/lib/types";
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

  // Scroll to last-read passage when reader loads
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
    if (!lastPassageEvent) return;
    const passageId = lastPassageEvent.passageId!;
    const target = passageRefs.current[passageId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [reader, trail, selectedWorkId]);

  // ----------------------------------------------------------------
  // Annotation actions
  // ----------------------------------------------------------------

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

  async function closeAnnotation(id: string) {
    if (!reader) return;
    await fetch("/api/annotations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", id }),
    });
    setReader(await fetchReader(reader.id));
    await refreshAnnotations();
  }

  async function submitInlineReply(annotationId: string) {
    if (!reader) return;
    const body = (replyDrafts[annotationId] ?? "").trim();
    if (!body) return;
    const annotation = reader.annotations.find((a) => a.id === annotationId);
    await fetch("/api/annotations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: annotationId, userName: "demo-user", body }),
    });
    await postTrailEvent({
      workId: reader.work.id,
      editionId: reader.id,
      passageId: annotation?.passageId,
      eventType: "REPLY",
    });
    setReplyDrafts((prev) => ({ ...prev, [annotationId]: "" }));
    setReader(await fetchReader(reader.id));
    await refreshAnnotations();
  }

  async function submitGlobalReply(id: string) {
    const body = (globalReplyDrafts[id] ?? "").trim();
    if (!id || !body) return;
    const annotation = globalAnnotations.find((a) => a.id === id);
    await fetch("/api/annotations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId: id, userName: "demo-user", body }),
    });
    if (annotation) {
      await postTrailEvent({
        workId: annotation.workId,
        editionId: annotation.editionId,
        passageId: annotation.passageId,
        eventType: "REPLY",
      });
    }
    setGlobalReplyDrafts((prev) => ({ ...prev, [id]: "" }));
    await refreshAnnotations();
    if (reader) setReader(await fetchReader(reader.id));
  }

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

  function handleWorkSelect(id: string) {
    setSelectedWorkId(id);
  }

  function handleTrailNavigate(workId: string) {
    setTab("corpus");
    setSelectedWorkId(workId);
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="app">
      <header className="topbar">
        <div className="logo">Reading Box</div>
        <nav className="tabs">
          <button
            className={tab === "corpus" ? "active" : ""}
            onClick={() => setTab("corpus")}
          >
            Corpus
          </button>
          <button
            className={tab === "trail" ? "active" : ""}
            onClick={() => setTab("trail")}
          >
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
              <CorpusList works={works} onSelect={handleWorkSelect} />
            ) : (
              <CorpusGraph
                works={works}
                selectedWorkId={selectedWorkId}
                onSelect={handleWorkSelect}
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
            onSubmitAnnotation={submitAnnotation}
            onCloseAnnotation={closeAnnotation}
            onReplyDraftChange={(annotationId, value) =>
              setReplyDrafts((prev) => ({ ...prev, [annotationId]: value }))
            }
            onSubmitReply={submitInlineReply}
          />

          <ContextPanel
            works={works}
            selectedWorkId={selectedWorkId}
            onSelect={handleWorkSelect}
          />
        </main>
      )}

      {tab === "trail" && (
        <TrailFeed trail={trail} onNavigate={handleTrailNavigate} />
      )}

      {tab === "annotations" && (
        <AnnotationsFeed
          globalAnnotations={globalAnnotations}
          globalReplyDrafts={globalReplyDrafts}
          onReplyDraftChange={(id, value) =>
            setGlobalReplyDrafts((prev) => ({ ...prev, [id]: value }))
          }
          onSubmitGlobalReply={submitGlobalReply}
        />
      )}
    </div>
  );

  // ----------------------------------------------------------------
  // Data helpers
  // ----------------------------------------------------------------

  async function refreshAnnotations() {
    const json = (await fetch("/api/annotations").then((r) =>
      r.json(),
    )) as AnnotationDto[];
    setGlobalAnnotations(json);
  }

  async function refreshTrail() {
    const json = (await fetch("/api/trail?userId=demo-user").then((r) =>
      r.json(),
    )) as TrailEventDto[];
    setTrail(json);
  }

  async function postTrailEvent(input: {
    workId: string;
    editionId: string;
    passageId?: string | null;
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
