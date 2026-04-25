"use client";

import type { AnnotationDto } from "@/lib/types";

interface Props {
  globalAnnotations: AnnotationDto[];
  globalReplyDrafts: Record<string, string>;
  onReplyDraftChange: (annotationId: string, value: string) => void;
  onSubmitGlobalReply: (annotationId: string) => Promise<void>;
}

export function AnnotationsFeed({
  globalAnnotations,
  globalReplyDrafts,
  onReplyDraftChange,
  onSubmitGlobalReply,
}: Props) {
  return (
    <main className="annotations">
      <h2>Annotations</h2>

      {globalAnnotations.length === 0 ? (
        <div className="empty">
          No annotations yet — highlight a passage in any work to begin a thread.
        </div>
      ) : (
        globalAnnotations.map((a) => (
          <div className="annotation-card" key={a.id}>
            <div className="annotation-head">
              <b>{a.userName}</b>
              <span className="annotation-state">{a.state === "OPEN" ? "open" : "closed"}</span>
            </div>

            <div className="annotation-body">{a.body}</div>

            {a.replies.map((r) => (
              <div className="reply" key={r.id}>
                <b>{r.userName}</b>: {r.body}
              </div>
            ))}

            {a.state === "OPEN" && (
              <div className="reply-compose">
                <input
                  value={globalReplyDrafts[a.id] ?? ""}
                  placeholder="Add a reply…"
                  onChange={(e) => onReplyDraftChange(a.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void onSubmitGlobalReply(a.id);
                  }}
                />
                <button onClick={() => void onSubmitGlobalReply(a.id)}>Reply</button>
              </div>
            )}
          </div>
        ))
      )}
    </main>
  );
}
