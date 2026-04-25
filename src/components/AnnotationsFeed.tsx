"use client";

import type { AnnotationDto } from "@/lib/types";

interface Props {
  globalAnnotations: AnnotationDto[];
  globalReplyDrafts: Record<string, string>;
  onReplyDraftChange: (id: string, value: string) => void;
  onSubmitGlobalReply: (id: string) => Promise<void>;
}

export function AnnotationsFeed({
  globalAnnotations,
  globalReplyDrafts,
  onReplyDraftChange,
  onSubmitGlobalReply,
}: Props) {
  return (
    <main className="annotations">
      <h2>Global Annotations</h2>
      {globalAnnotations.length === 0 ? (
        <p className="passages-empty">
          No annotations yet — highlight a passage in a work to start a thread.
        </p>
      ) : (
        globalAnnotations.map((a) => (
          <div className="annotation-card" key={a.id}>
            <div>
              <strong>{a.userName}</strong> · {a.state}
            </div>
            <div>{a.body}</div>
            <div>replies: {a.replies.length}</div>
            {a.state === "OPEN" && (
              <div className="reply-compose">
                <input
                  value={globalReplyDrafts[a.id] ?? ""}
                  placeholder="Reply from global view..."
                  onChange={(e) => onReplyDraftChange(a.id, e.target.value)}
                />
                <button onClick={() => void onSubmitGlobalReply(a.id)}>
                  reply
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </main>
  );
}
