"use client";

import type { ReaderDto, SelectionState, PassageDto } from "@/lib/types";
import type { MutableRefObject } from "react";

interface Props {
  reader: ReaderDto | null;
  selectedPassageId: string | null;
  selection: SelectionState | null;
  annotationBody: string;
  replyDrafts: Record<string, string>;
  passageRefs: MutableRefObject<Record<string, HTMLParagraphElement | null>>;
  onPassageMouseUp: (
    passageId: string,
    resolved: SelectionState | null,
  ) => void;
  onAnnotationBodyChange: (value: string) => void;
  onSubmitAnnotation: () => Promise<void>;
  onCloseAnnotation: (id: string) => Promise<void>;
  onReplyDraftChange: (annotationId: string, value: string) => void;
  onSubmitReply: (annotationId: string) => Promise<void>;
}

export function PassageReader({
  reader,
  selectedPassageId,
  selection,
  annotationBody,
  replyDrafts,
  passageRefs,
  onPassageMouseUp,
  onAnnotationBodyChange,
  onSubmitAnnotation,
  onCloseAnnotation,
  onReplyDraftChange,
  onSubmitReply,
}: Props) {
  if (!reader) {
    return (
      <section className="reader">
        <div className="empty">Select a work from the corpus to begin reading.</div>
      </section>
    );
  }

  return (
    <section className="reader">
      <h1>{reader.work.title}</h1>
      <p className="authors">{reader.work.authors.join(", ")}</p>
      <div className="passages">
        {reader.passages.length === 0 ? (
          <p className="passages-empty">
            No passages found for this edition. The import may have failed — re-run the seed script.
          </p>
        ) : (
          reader.passages.map((p: PassageDto, idx: number) => (
            <article key={p.id}>
              {(idx === 0 || reader.passages[idx - 1]?.sectionKey !== p.sectionKey) && (
                <h3 className="section-heading">{p.sectionKey}</h3>
              )}
              <p
                ref={(el) => { passageRefs.current[p.id] = el; }}
                data-passage-id={p.id}
                onMouseUp={(event) => {
                  const resolved = resolveSelectionOffsets(event.currentTarget);
                  onPassageMouseUp(p.id, resolved);
                }}
              >
                {selectedPassageId === p.id && selection
                  ? (
                    <>
                      {p.text.slice(0, selection.start)}
                      <mark>{p.text.slice(selection.start, selection.end)}</mark>
                      {p.text.slice(selection.end)}
                    </>
                  )
                  : p.text
                }
              </p>

              {selectedPassageId === p.id && selection && (
                <div className="compose-inline">
                  <div className="compose-quote">&quot;{selection.exact}&quot;</div>
                  <textarea
                    value={annotationBody}
                    placeholder="Open a thread on this selected passage..."
                    onChange={(e) => onAnnotationBodyChange(e.target.value)}
                  />
                  <button onClick={() => void onSubmitAnnotation()}>Create annotation</button>
                </div>
              )}

              {reader.annotations
                .filter((a) => a.passageId === p.id)
                .map((a) => (
                  <div key={a.id} className="annotation">
                    <div className="annotation-head">
                      <b>{a.userName}</b> · {a.state}
                      {a.state === "OPEN" && (
                        <button onClick={() => void onCloseAnnotation(a.id)}>close</button>
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
                          onChange={(e) => onReplyDraftChange(a.id, e.target.value)}
                        />
                        <button onClick={() => void onSubmitReply(a.id)}>reply</button>
                      </div>
                    )}
                  </div>
                ))}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

// ── Helpers (same logic as before, co-located with the reader) ──

function resolveSelectionOffsets(
  container: HTMLElement,
): SelectionState | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const exact = range.toString().trim();
  if (!exact) return null;
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) return null;
  const start = getTextOffsetWithTreeWalker(
    container,
    range.startContainer,
    range.startOffset,
  );
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
