import { PrismaClient } from "@prisma/client";
import { importGutendexBook } from "../src/lib/ingest";

const prisma = new PrismaClient();

// Gutenberg IDs — Stoic / Hermetic / Neo-Platonic philosophy cluster
// 2680  Marcus Aurelius — Meditations
// 4363  Nietzsche      — Beyond Good and Evil
// 4399  Epictetus      — Enchiridion
// 1974  Plato          — The Republic
// 1100  Dante          — The Divine Comedy (Inferno)
// 3207  Spinoza        — Ethics
const BOOKS: { id: number; label: string }[] = [
  { id: 2680, label: "Meditations" },
  { id: 4363, label: "Beyond Good and Evil" },
  { id: 4399, label: "Enchiridion" },
  { id: 1974, label: "The Republic" },
  { id: 1100, label: "Inferno" },
  { id: 3207, label: "Ethics" },
];

// [sourceIdx, targetIdx, relation]
const REFERENCE_EDGES: [number, number, string][] = [
  [2, 0, "influence"],   // Enchiridion → Meditations (Epictetus influenced Aurelius)
  [2, 0, "commentary"],  // Enchiridion → Meditations (Stoic commentary tradition)
  [1, 0, "response"],    // Beyond G&E → Meditations (Nietzsche vs Stoics)
  [1, 3, "response"],    // Beyond G&E → Republic (Nietzsche critiques Plato)
  [3, 5, "influence"],   // Republic → Ethics (Plato influenced Spinoza)
  [5, 0, "influence"],   // Ethics → Meditations (Stoic parallels)
  [4, 3, "allusion"],    // Inferno → Republic (Platonic cosmology)
];

const SEED_ANNOTATIONS: {
  bookIdx: number;
  passageIdx: number;
  userName: string;
  body: string;
  replies: { userName: string; body: string }[];
}[] = [
  {
    bookIdx: 0,
    passageIdx: 3,
    userName: "alice",
    body: "Aurelius keeps returning to the idea that our judgements, not external events, cause suffering. This is the core Stoic move.",
    replies: [
      { userName: "bob", body: "Epictetus makes the same point almost word for word in the Enchiridion — clearly the direct source here." },
      { userName: "alice", body: "Yes, and Nietzsche would say this is exactly the kind of life-denying stance he objects to." },
    ],
  },
  {
    bookIdx: 1,
    passageIdx: 5,
    userName: "bob",
    body: "The 'will to power' passage here is often misread as political. It's really about self-overcoming.",
    replies: [
      { userName: "alice", body: "Right — and ironically Aurelius is doing something similar when he drills the exercises each morning." },
    ],
  },
  {
    bookIdx: 2,
    passageIdx: 1,
    userName: "alice",
    body: "The opening distinction between what is 'up to us' and what is not is one of the most load-bearing ideas in the whole corpus.",
    replies: [],
  },
  {
    bookIdx: 3,
    passageIdx: 8,
    userName: "bob",
    body: "The allegory of the cave is so compressed here. Every line carries enormous weight.",
    replies: [
      { userName: "alice", body: "Spinoza picks this metaphor back up in Ethics — the transition from imagination to reason mirrors the ascent from the cave." },
    ],
  },
];

async function upsertReference(sourceWorkId: string, targetWorkId: string, relation: string) {
  await prisma.reference.upsert({
    where: { sourceWorkId_targetWorkId_relation: { sourceWorkId, targetWorkId, relation } },
    update: {},
    create: { sourceWorkId, targetWorkId, relation },
  });
}

async function run() {
  console.log("Importing books...");
  const workIds: string[] = [];
  for (const book of BOOKS) {
    console.log(`  importing ${book.label} (id ${book.id})...`);
    const workId = await importGutendexBook(prisma, book.id);
    workIds.push(workId);
    console.log(`  done → ${workId}`);
  }

  console.log("Seeding reference edges...");
  for (const [srcIdx, tgtIdx, rel] of REFERENCE_EDGES) {
    const src = workIds[srcIdx];
    const tgt = workIds[tgtIdx];
    if (src && tgt) {
      await upsertReference(src, tgt, rel);
      console.log(`  ${BOOKS[srcIdx]!.label} --[${rel}]--> ${BOOKS[tgtIdx]!.label}`);
    }
  }

  console.log("Seeding pre-baked annotations...");
  for (const ann of SEED_ANNOTATIONS) {
    const workId = workIds[ann.bookIdx];
    if (!workId) continue;
    const edition = await prisma.edition.findFirst({ where: { workId } });
    if (!edition) continue;
    const passages = await prisma.passage.findMany({
      where: { editionId: edition.id },
      orderBy: { passageIndex: "asc" },
      take: ann.passageIdx + 1,
    });
    const passage = passages[ann.passageIdx];
    if (!passage) continue;
    // Use a safe selection: first 60 chars of passage text
    const startOffset = 0;
    const endOffset = Math.min(60, passage.text.length);
    const exact = passage.text.slice(startOffset, endOffset);
    const prefix = "";
    const suffix = passage.text.slice(endOffset, endOffset + 32);
    const existing = await prisma.annotation.findFirst({
      where: { passageId: passage.id, userName: ann.userName, parentId: null },
    });
    let rootId: string;
    if (existing) {
      rootId = existing.id;
    } else {
      const root = await prisma.annotation.create({
        data: {
          editionId: edition.id,
          passageId: passage.id,
          userName: ann.userName,
          exact,
          prefix,
          suffix,
          startOffset,
          endOffset,
          body: ann.body,
        },
      });
      rootId = root.id;
    }
    for (const reply of ann.replies) {
      const alreadyReplied = await prisma.annotation.findFirst({
        where: { parentId: rootId, userName: reply.userName, body: reply.body },
      });
      if (!alreadyReplied) {
        await prisma.annotation.create({
          data: {
            editionId: edition.id,
            passageId: passage.id,
            userName: reply.userName,
            exact,
            prefix,
            suffix,
            startOffset,
            endOffset,
            body: reply.body,
            parentId: rootId,
          },
        });
      }
    }
    console.log(`  annotated passage ${ann.passageIdx} of ${BOOKS[ann.bookIdx]!.label} as ${ann.userName}`);
  }

  console.log("\nSeed complete.");
  console.log(`  ${workIds.length} works, ${REFERENCE_EDGES.length} reference edges, ${SEED_ANNOTATIONS.length} annotation threads`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
