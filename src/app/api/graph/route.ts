import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const works = await db.work.findMany({
    include: {
      outgoing: true,
      editions: { include: { annotations: true } },
    },
  });

  const corpusNodes = works.map((w) => ({ id: w.id, label: w.title, type: "work" }));
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
