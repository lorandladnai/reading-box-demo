import { PrismaClient } from "@prisma/client";
import { importGutendexBook } from "../src/lib/ingest";

const prisma = new PrismaClient();

// Gutenberg IDs — alchemical & hermetic corpus
// 6485   Waite          — Collectanea Chemica
// 35097  Redgrove       — Alchemy: Ancient and Modern
// 14218  Pattison Muir  — The Story of Alchemy
// 2300   Waite          — The Hermetic Museum Vol. 1
// 2301   Waite          — The Hermetic Museum Vol. 2
// 1653   Hartmann       — Theophrastus Paracelsus
const BOOKS: { id: number; label: string }[] = [
  { id: 6485,  label: "Collectanea Chemica" },
  { id: 35097, label: "Alchemy: Ancient and Modern" },
  { id: 14218, label: "The Story of Alchemy" },
  { id: 2300,  label: "The Hermetic Museum Vol. 1" },
  { id: 2301,  label: "The Hermetic Museum Vol. 2" },
  { id: 1653,  label: "Theophrastus Paracelsus" },
];

// [sourceIdx, targetIdx, relation]
const REFERENCE_EDGES: [number, number, string][] = [
  [0, 3, "commentary"],   // Collectanea → Hermetic Museum Vol.1 (shared Waite tradition)
  [0, 4, "commentary"],   // Collectanea → Hermetic Museum Vol.2
  [1, 2, "influence"],    // Redgrove → Pattison Muir (historiographic lineage)
  [5, 3, "allusion"],     // Paracelsus → Hermetic Museum Vol.1 (Paracelsian texts collected within)
  [5, 0, "influence"],    // Paracelsus → Collectanea (Paracelsian corpus)
  [3, 4, "commentary"],   // Vol.1 → Vol.2 (companion volumes)
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
    passageIdx: 2,
    userName: "alice",
    body: "The transmutation metaphor here operates on two levels simultaneously — the physical laboratory process and the spiritual purification of the operator. Waite is insistent that the two cannot be separated.",
    replies: [
      { userName: "bob", body: "The Hermetic Museum makes this even more explicit — the adept\'s interior state is said to affect the outcome of the work." },
      { userName: "alice", body: "Which is why Paracelsus insists so heavily on the moral character of the physician-alchemist." },
    ],
  },
  {
    bookIdx: 3,
    passageIdx: 4,
    userName: "bob",
    body: "The Emerald Tablet citations throughout this volume suggest the editors conceived of the Museum as a practical commentary on Hermetic axioms rather than mere anthology.",
    replies: [
      { userName: "alice", body: "Yes — each treatise is almost positioned as an elaboration of \'as above, so below\'." },
    ],
  },
  {
    bookIdx: 5,
    passageIdx: 1,
    userName: "alice",
    body: "Hartmann\'s framing of Paracelsus is sympathetic to the point of hagiography, but the primary source passages he quotes are genuinely extraordinary.",
    replies: [],
  },
  {
    bookIdx: 1,
    passageIdx: 6,
    userName: "bob",
    body: "Redgrove\'s account of the Arab transmission of Alexandrian alchemy is the clearest short history I have found anywhere. He traces the Jabir corpus directly to the Hermetic tradition.",
    replies: [
      { userName: "alice", body: "Pattison Muir covers the same ground but is more skeptical about the Arab claims — worth reading them side by side." },
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
  console.log("Importing alchemical corpus...");
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
    const startOffset = 0;
    const endOffset = Math.min(60, passage.text.length);
    const exact = passage.text.slice(startOffset, endOffset);
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
          prefix: "",
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
            prefix: "",
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
  .catch((error) => { console.error(error); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
