import { PrismaClient } from "@prisma/client";
import {
  htmlToParagraphs,
  normalizeWhitespace,
  segmentCanonicalPassages,
  stripBoilerplate,
  textToParagraphs,
} from "../src/lib/normalize";

type GutendexBook = {
  id: number;
  title: string;
  authors: Array<{ name: string }>;
  subjects: string[];
  languages: string[];
  formats: Record<string, string>;
};

const prisma = new PrismaClient();

async function run() {
  const sourceId = Number(process.argv[2] ?? 2680); // Meditations
  const response = await fetch(`https://gutendex.com/books/${sourceId}`);
  if (!response.ok) {
    throw new Error(`Gutendex fetch failed: ${response.status}`);
  }

  const book = (await response.json()) as GutendexBook;
  const htmlUrl =
    book.formats["text/html; charset=utf-8"] ?? book.formats["text/html"] ?? null;
  const textUrl =
    book.formats["text/plain; charset=utf-8"] ?? book.formats["text/plain"] ?? null;
  const sourceUrl = htmlUrl ?? textUrl;
  if (!sourceUrl) throw new Error("No supported source format found");

  const sourceRes = await fetch(sourceUrl);
  if (!sourceRes.ok) throw new Error(`Source fetch failed: ${sourceRes.status}`);
  const raw = await sourceRes.text();
  const cleaned = stripBoilerplate(normalizeWhitespace(raw));
  const paragraphs = htmlUrl ? htmlToParagraphs(cleaned) : textToParagraphs(cleaned);
  const passages = segmentCanonicalPassages(paragraphs.slice(0, 220));

  const slug = slugify(book.title);
  const work = await prisma.work.upsert({
    where: { slug },
    update: {
      title: book.title,
      authors: book.authors.map((a) => a.name),
      subjects: book.subjects,
    },
    create: {
      slug,
      title: book.title,
      authors: book.authors.map((a) => a.name),
      subjects: book.subjects,
    },
  });

  await prisma.edition.deleteMany({ where: { workId: work.id, source: "gutenberg" } });
  const edition = await prisma.edition.create({
    data: {
      workId: work.id,
      source: "gutenberg",
      sourceId: String(book.id),
      sourceUrl,
      language: book.languages[0] ?? "en",
      format: htmlUrl ? "text/html" : "text/plain",
      ingestVersion: "v1",
      rawHtml: htmlUrl ? cleaned : null,
      rawText: textUrl ? cleaned : null,
    },
  });

  if (passages.length === 0) throw new Error("No passages were produced");
  await prisma.passage.createMany({
    data: passages.map((p) => ({
      editionId: edition.id,
      sectionKey: p.sectionKey,
      passageIndex: p.passageIndex,
      text: p.text,
      html: p.html,
      charStart: p.charStart,
      charEnd: p.charEnd,
    })),
  });

  console.log(`Imported ${work.title} (${passages.length} passages)`);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64);
}

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
