import { ThreadState } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { buildSelector } from "@/lib/normalize";

const createSchema = z.object({
  editionId: z.string().min(1),
  passageId: z.string().min(1),
  userName: z.string().min(1).default("demo-user"),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().positive(),
  body: z.string().min(1),
});

export async function GET() {
  const annotations = await db.annotation.findMany({
    where: { parentId: null },
    include: { passage: true, edition: { include: { work: true } }, replies: true },
    orderBy: { createdAt: "desc" },
  });

  const withAttention = annotations.map((a) => ({
    ...a,
    workId: a.edition.workId,
    attention: a.replies.length + 1,
  }));

  withAttention.sort((a, b) => b.attention - a.attention);
  return NextResponse.json(withAttention);
}

export async function POST(req: Request) {
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 });
  const payload = parsed.data;

  const passage = await db.passage.findUnique({ where: { id: payload.passageId } });
  if (!passage) return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  const selector = buildSelector(passage.text, payload.startOffset, payload.endOffset);
  if (!selector.exact) return NextResponse.json({ error: "Invalid selection" }, { status: 400 });

  const annotation = await db.annotation.create({
    data: {
      editionId: payload.editionId,
      passageId: payload.passageId,
      userName: payload.userName,
      exact: selector.exact,
      prefix: selector.prefix,
      suffix: selector.suffix,
      startOffset: payload.startOffset,
      endOffset: payload.endOffset,
      body: payload.body,
    },
  });

  return NextResponse.json(annotation, { status: 201 });
}

const replySchema = z.object({
  parentId: z.string().min(1),
  body: z.string().min(1),
  userName: z.string().default("demo-user"),
});

export async function PATCH(req: Request) {
  const body = (await req.json()) as Record<string, unknown>;
  if (body.action === "close") {
    const id = String(body.id ?? "");
    const updated = await db.annotation.update({
      where: { id },
      data: { state: ThreadState.CLOSED },
    });
    return NextResponse.json(updated);
  }

  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(parsed.error.flatten(), { status: 400 });
  const parent = await db.annotation.findUnique({ where: { id: parsed.data.parentId } });
  if (!parent) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  if (parent.state === ThreadState.CLOSED) {
    return NextResponse.json({ error: "Thread is closed" }, { status: 400 });
  }

  const reply = await db.annotation.create({
    data: {
      editionId: parent.editionId,
      passageId: parent.passageId,
      userName: parsed.data.userName,
      exact: parent.exact,
      prefix: parent.prefix,
      suffix: parent.suffix,
      startOffset: parent.startOffset,
      endOffset: parent.endOffset,
      body: parsed.data.body,
      parentId: parent.id,
    },
  });
  return NextResponse.json(reply, { status: 201 });
}
