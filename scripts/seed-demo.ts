import { PrismaClient } from "@prisma/client";
import { importGutendexBook } from "../src/lib/ingest";

const prisma = new PrismaClient();

async function run() {
  // A small, stable seed corpus suitable for immediate demo.
  const ids = [2680, 1342, 4363]; // Meditations, Pride and Prejudice, Beyond Good and Evil
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
          sourceWorkId: workIds[0],
          targetWorkId: workIds[1],
          relation: "contrast",
        },
      },
      update: {},
      create: {
        sourceWorkId: workIds[0],
        targetWorkId: workIds[1],
        relation: "contrast",
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
