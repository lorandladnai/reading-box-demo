import { TrailEventType, Visibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import type { PublicTrailDto } from "@/lib/types";

const schema = z.object({
  userId: z.string().default("demo-user"),
  workId: z.string().min(1),
  editionId: z.string().min(1),
  passageId: z.string().nullable().optional(),
  eventType: z.nativeEnum(TrailEventType),
  visibility: z.nativeEnum(Visibility).default(Visibility.PUBLIC),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ?public=1 → return per-work visitor counts for all PUBLIC events
  if (searchParams.get("public") === "1") {
    const events = await db.trailEvent.findMany({
      where: { visibility: Visibility.PUBLIC },
      select: { workId: true, userId: true },
    });
    const map = new Map<string, Set<string>>();
    for (const e of events) {
      if (!map.has(e.workId)) map.set(e.workId, new Set());
      map.get(e.workId)!.add(e.userId);
    }
    const result: PublicTrailDto[] = [];
    for (const [workId, visitors] of map) {
      result.push({ workId, visitors: [...visitors] });
    }
    return NextResponse.json(result);
  }

  // Default: return trail for a specific user
  const userId = searchParams.get("userId") ?? "demo-user";
  const trail = await db.trailEvent.findMany({
    where: { userId, visibility: { in: [Visibility.PUBLIC] } },
    include: { work: true, passage: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(trail);
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 });
  const created = await db.trailEvent.create({ data: parsed.data });
  return NextResponse.json(created, { status: 201 });
}
