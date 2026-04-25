import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const works = await db.work.findMany({
    include: {
      outgoing: true,
      incoming: true,
      editions: {
        include: {
          annotations: { where: { parentId: null }, include: { replies: true } },
        },
      },
    },
  });

  const corpusNodes = works.map((w) => {
    const annotationCount = w.editions.reduce((sum, e) => sum + e.annotations.length, 0);
    const replyCount = w.editions.reduce(
      (sum, e) => sum + e.annotations.reduce((s, a) => s + a.replies.length, 0),
      0,
    );
    return {
      id: w.id,
      label: w.title,
      authors: w.authors,
      type: "work",
      degree: w.outgoing.length + w.incoming.length,
      annotationCount,
      attention: annotationCount + replyCount,
    };
  });

  const corpusEdges = works.flatMap((w) =>
    w.outgoing.map((r) => ({
      id: r.id,
      source: r.sourceWorkId,
      target: r.targetWorkId,
      relation: r.relation,
    })),
  );

  const annotationNodes = works.flatMap((w) =>
    w.editions.flatMap((e) =>
      e.annotations.map((a) => ({
        id: a.id,
        type: "annotation",
        workId: w.id,
        state: a.state,
        parentId: a.parentId,
        replyCount: a.replies.length,
      })),
    ),
  );

  const annotationEdges = annotationNodes.flatMap((a) => {
    if (a.parentId) {
      return [{ source: a.id, target: a.parentId, relation: "replies_to" }];
    }
    return [{ source: a.id, target: a.workId, relation: "annotates_work" }];
  });

  return NextResponse.json({
    corpus: { nodes: corpusNodes, edges: corpusEdges },
    annotations: { nodes: annotationNodes, edges: annotationEdges },
  });
}
