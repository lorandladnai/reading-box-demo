/**
 * Bulk importer — alchemical & hermetic texts from Project Gutenberg
 *
 * Run: npm run import:alchemy
 */
import { PrismaClient } from "@prisma/client";
import { importGutendexBook } from "../src/lib/ingest.ts";

const prisma = new PrismaClient();

const TEXTS = [
  // ── Core hermetic / alchemical primaries ──────────────────────
  { id: 6485,  label: "Collectanea Chemica (Waite ed.)" },
  { id: 35097, label: "Alchemy: Ancient and Modern — Redgrove" },
  { id: 14218, label: "The Story of Alchemy — Pattison Muir" },
  { id: 2300,  label: "The Hermetic Museum Vol. 1 — Waite" },
  { id: 2301,  label: "The Hermetic Museum Vol. 2 — Waite" },
  // ── Rosicrucianism & Paracelsus tradition ──────────────────────
  { id: 24777, label: "The Rosicrucian Cosmo-Conception — Heindel" },
  { id: 10112, label: "The Secret Symbols of the Rosicrucians" },
  { id: 1653,  label: "Theophrastus Paracelsus: Life & Writings — Hartmann" },
] as const;

async function run() {
  console.log(`\nReading Box — Alchemy corpus importer`);
  console.log(`Importing ${TEXTS.length} texts from Project Gutenberg...\n`);

  let succeeded = 0;
  let failed = 0;

  for (const book of TEXTS) {
    process.stdout.write(`  [${book.id}] ${book.label} ... `);
    try {
      const workId = await importGutendexBook(prisma, book.id);
      console.log(`✓ (${workId})`);
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`✗ ${message}`);
      failed++;
    }
  }

  console.log(`\nDone. ${succeeded} imported, ${failed} failed.`);
  if (failed > 0) {
    console.log(`Re-run with: npm run import:gutenberg -- <id>  to retry individual books.`);
  }
}

run()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
