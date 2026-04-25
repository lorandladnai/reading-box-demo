import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ editionId: string }> };

const DEFAULT_PAGE_SIZE = 60;

export async function GET(req: Request, ctx: Ctx) {
  const { editionId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(200, Math.max(10, parseInt(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10)));

  const edition = await db.edition.findUnique({
    where: { id: editionId },
    include: { work: true },
  });
  if (!edition) return NextResponse.json({ error: "Edition not found" }, { status: 404 });

  const totalPassages = await db.passage.count({ where: { editionId } });

  const passages = await db.passage.findMany({
    where: { editionId },
    orderBy: { passageIndex: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: { id: true, passageIndex: true, text: true, sectionKey: true },
  });

  const annotations = await db.annotation.findMany({
    where: { editionId, parentId: null },
    include: { replies: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    id: edition.id,
    work: { id: edition.work.id, title: edition.work.title, authors: edition.work.authors },
    passages,
    totalPassages,
    page,
    pageSize,
    annotations: annotations.map((a) => ({
      id: a.id,
      body: a.body,
      state: a.state,
      passageId: a.passageId,
      userName: a.userName,
      startOffset: a.startOffset,
      endOffset: a.endOffset,
      exact: a.exact,
      replies: a.replies.map((r) => ({ id: r.id, body: r.body, userName: r.userName })),
    })),
  });
}
