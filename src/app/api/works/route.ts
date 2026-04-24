import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const works = await db.work.findMany({
    include: {
      editions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { passages: { select: { id: true }, take: 1 } },
      },
      outgoing: { include: { targetWork: true } },
    },
    orderBy: { title: "asc" },
  });

  return NextResponse.json(
    works.map((work) => ({
      id: work.id,
      slug: work.slug,
      title: work.title,
      authors: work.authors,
      subjects: work.subjects,
      editionId: work.editions[0]?.id ?? null,
      references: work.outgoing.map((r) => ({
        targetWorkId: r.targetWorkId,
        targetTitle: r.targetWork.title,
        relation: r.relation,
      })),
    })),
  );
}
