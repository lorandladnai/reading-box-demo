import { PrismaClient } from "@prisma/client";
import { importGutendexBook } from "../src/lib/ingest";

const prisma = new PrismaClient();

async function run() {
  // Coherent philosophy-focused seed corpus.
  const ids = [2680, 4363, 45109]; // Meditations, Beyond Good and Evil, Enchiridion
  const workIds: string[] = [];

  for (const id of ids) {
    const workId = await importGutendexBook(prisma, id);
    workIds.push(workId);
  }

  if (workIds.length >= 3) {
    await prisma.reference.upsert({
      where: {
        sourceWorkId_targetWorkId_relation: {
          sourceWorkId: workIds[2],
          targetWorkId: workIds[0],
          relation: "influence",
        },
      },
      update: {},
      create: {
        sourceWorkId: workIds[2],
        targetWorkId: workIds[0],
        relation: "influence",
      },
    });
    await prisma.reference.upsert({
      where: {
        sourceWorkId_targetWorkId_relation: {
          sourceWorkId: workIds[2],
          targetWorkId: workIds[0],
          relation: "commentary",
        },
      },
      update: {},
      create: {
        sourceWorkId: workIds[2],
        targetWorkId: workIds[0],
        relation: "commentary",
      },
    });
    await prisma.reference.upsert({
      where: {
        sourceWorkId_targetWorkId_relation: {
          sourceWorkId: workIds[1],
          targetWorkId: workIds[0],
          relation: "response",
        },
      },
      update: {},
      create: {
        sourceWorkId: workIds[1],
        targetWorkId: workIds[0],
        relation: "response",
      },
    });
  }

  console.log("Seed complete with imported works and reference edges.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
