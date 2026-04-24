import { PrismaClient } from "@prisma/client";
import { importGutendexBook } from "../src/lib/ingest";

const prisma = new PrismaClient();

async function run() {
  const sourceId = Number(process.argv[2] ?? 2680); // Meditations
  const workId = await importGutendexBook(prisma, sourceId);
  console.log(`Imported work ${workId} from Gutenberg id ${sourceId}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
