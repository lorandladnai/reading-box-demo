import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Ctx = { params: Promise<{ editionId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { editionId } = await ctx.params;
  const edition = await db.edition.findUnique({
    where: { id: editionId },
    include: {
      work: true,
      passages: { orderBy: { passageIndex: "asc" } },
      annotations: {
        where: { parentId: null },
        include: { replies: { orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!edition) return NextResponse.json({ error: "Edition not found" }, { status: 404 });
  return NextResponse.json(edition);
}
