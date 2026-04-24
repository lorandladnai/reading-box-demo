import Link from "next/link";

export default function Home() {
  return (
    <main className="cover">
      <div className="cover-inner">
        <p className="cover-kicker">Reading Box</p>
        <h1>A communal co-reading platform where the reader is primary.</h1>
        <p className="cover-lead">
          Not a habit tracker. Not a social feed. A quiet shared reading space where people
          move through philosophical and alchemical texts, leaving traces for others to find.
        </p>

        <section className="cover-grid">
          <article className="cover-card">
            <h2>Core Concept</h2>
            <p>
              Goodreads/Moly-style text community, Genius-style annotation-first reading, and
              Death Stranding style indirect evidence of others.
            </p>
          </article>
          <article className="cover-card">
            <h2>Corpus As Graph</h2>
            <p>
              Corpus Hermeticum, Emerald Tablet, Kybalion, Paracelsus, Ficino, Jung. The corpus
              is a directed web of references across centuries, not a static shelf.
            </p>
          </article>
          <article className="cover-card">
            <h2>Three Screens</h2>
            <p>
              Graph/List entry, Reader with context minimap and trace density filter, and My
              Trail as a persistent personal route through the corpus.
            </p>
          </article>
          <article className="cover-card">
            <h2>Annotation Model</h2>
            <p>
              Highlight to open a thread, replies underneath, open/closed thread state, and a
              global traces view sorted by attention rather than likes.
            </p>
          </article>
        </section>

        <div className="cover-actions">
          <Link className="cover-primary" href="/demo">
            Open Interactive Demo
          </Link>
        </div>
      </div>
    </main>
  );
}
