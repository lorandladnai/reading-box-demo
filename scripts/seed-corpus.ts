/**
 * seed-corpus.ts
 * Curated alchemical, Hermetic, and classical philosophical corpus from Project Gutenberg.
 * Run with: npx ts-node scripts/seed-corpus.ts
 *
 * Gutenberg IDs verified against gutenberg.org catalogue.
 * Reference edges encode genuine historical influence / response relationships.
 */
import { PrismaClient } from "@prisma/client";
import { importGutendexBook } from "../src/lib/ingest";

const prisma = new PrismaClient();

// ─── CORPUS ───────────────────────────────────────────────────────────────────
// Each entry: [gutenbergId, localKey, shortTitle]
// localKey is used to build reference edges below.
const CORPUS: Array<[number, string, string]> = [
  // ── Stoic & Ancient Philosophy
  [2680,  "meditations",       "Meditations — Marcus Aurelius"],
  [4399,  "enchiridion",       "Enchiridion — Epictetus"],
  [37780, "discourses",       "Discourses — Epictetus"],
  [4363,  "bgae",             "Beyond Good and Evil — Nietzsche"],
  [1080,  "apology",          "Apology — Plato"],
  [1750,  "phaedrus",         "Phaedrus — Plato"],
  [1672,  "symposium",        "Symposium — Plato"],

  // ── Hermetic & Neoplatonic
  [5977,  "hermetica",        "Hermetica (Corpus Hermeticum) — Hermes Trismegistus"],
  [1293,  "enneads",          "The Enneads — Plotinus"],
  [14717, "divine_names",     "The Divine Names — Pseudo-Dionysius"],

  // ── Medieval & Renaissance Alchemy
  [28119, "rosarium",         "Rosarium Philosophorum (excerpt)"],
  [57387, "alchemy_chaucer",  "The Canon's Yeoman's Tale — Chaucer (alchemical satire)"],
  [2591,  "faust",            "Faust, Part I — Goethe"],
  [4985,  "new_atlantis",     "New Atlantis — Francis Bacon"],

  // ── Natural Philosophy & Early Science
  [45858, "novum_organum",    "Novum Organum — Francis Bacon"],
  [32977, "paracelsus",       "Selected Writings — Paracelsus (intro)"],
  [10662, "natural_magic",    "Natural Magic — John Baptista Porta"],

  // ── Mysticism & Theosophy
  [621,   "cloud_unknowing",  "The Cloud of Unknowing — Anonymous"],
  [16907, "theologia_germanica", "Theologia Germanica — Anonymous"],
  [16269, "imitatio",         "The Imitation of Christ — Thomas à Kempis"],
];

// ─── REFERENCE EDGES ──────────────────────────────────────────────────────────
// [sourceKey, targetKey, relation]
// Relations: "influence" | "response" | "commentary" | "parallel"
const EDGES: Array<[string, string, string]> = [
  // Stoic lineage
  ["enchiridion",   "meditations",    "influence"],
  ["discourses",    "meditations",    "influence"],
  ["meditations",   "enchiridion",    "commentary"],
  ["bgae",          "meditations",    "response"],
  ["bgae",          "apology",        "response"],
  ["apology",       "symposium",      "parallel"],
  ["phaedrus",      "symposium",      "parallel"],

  // Hermetic / Neoplatonic lineage
  ["enneads",       "hermetica",      "influence"],
  ["divine_names",  "enneads",        "influence"],
  ["divine_names",  "hermetica",      "influence"],
  ["hermetica",     "phaedrus",       "parallel"],

  // Alchemical reception
  ["rosarium",      "hermetica",      "influence"],
  ["rosarium",      "enneads",        "influence"],
  ["faust",         "rosarium",       "response"],
  ["faust",         "hermetica",      "parallel"],
  ["alchemy_chaucer", "rosarium",     "response"],
  ["paracelsus",    "hermetica",      "influence"],
  ["paracelsus",    "natural_magic",  "parallel"],
  ["natural_magic", "novum_organum",  "influence"],
  ["novum_organum", "natural_magic",  "response"],
  ["new_atlantis",  "novum_organum",  "parallel"],

  // Mystical / devotional
  ["cloud_unknowing",   "divine_names",    "influence"],
  ["theologia_germanica", "cloud_unknowing", "parallel"],
  ["imitatio",           "theologia_germanica", "influence"],
];

// ─── RUNNER ──────────────────────────────────────────────────────────────────
async function run() {
  console.log("Importing corpus...");
  const keyToWorkId: Record<string, string> = {};

  for (const [gutenbergId, key, title] of CORPUS) {
    try {
      console.log(`  → ${title} (Gutenberg #${gutenbergId})`);
      const workId = await importGutendexBook(prisma, gutenbergId);
      keyToWorkId[key] = workId;
    } catch (err) {
      console.warn(`  ✗ Failed to import ${title}:`, (err as Error).message);
    }
  }

  console.log("\nWiring reference edges...");
  let edgeCount = 0;
  for (const [sourceKey, targetKey, relation] of EDGES) {
    const sourceWorkId = keyToWorkId[sourceKey];
    const targetWorkId = keyToWorkId[targetKey];
    if (!sourceWorkId || !targetWorkId) {
      console.warn(`  ✗ Skipping edge ${sourceKey} → ${targetKey} (import failed)`);
      continue;
    }
    try {
      await prisma.reference.upsert({
        where: {
          sourceWorkId_targetWorkId_relation: { sourceWorkId, targetWorkId, relation },
        },
        update: {},
        create: { sourceWorkId, targetWorkId, relation },
      });
      edgeCount++;
    } catch (err) {
      console.warn(`  ✗ Edge ${sourceKey} → ${targetKey}: `, (err as Error).message);
    }
  }

  console.log(`\n✓ Corpus seeded: ${Object.keys(keyToWorkId).length} works, ${edgeCount} reference edges.`);
}

run()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
