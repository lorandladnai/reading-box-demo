import { TrailEventType, Visibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

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
  const userId = searchParams.get("userId") ?? "demo-user";
  // Only return PUBLIC events unless the requesting userId matches
  const visibilityFilter = [Visibility.PUBLIC];
  const trail = await db.trailEvent.findMany({
    where: { userId, visibility: { in: visibilityFilter } },
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
