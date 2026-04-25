import Link from "next/link";

export default function Home() {
  return (
    <main className="cover">
      <div className="cover-inner">
        <p className="cover-kicker">Reading Box · Interactive Demo</p>
        <h1>A communal co-reading space where the reader is primary.</h1>
        <p className="cover-lead">
          Not a habit tracker. Not a social feed. A quiet shared reading space where people
          move through philosophical texts, leaving traces for others to find. Think
          Genius-style annotation threads inside a directed graph of ideas across centuries.
        </p>

        <section className="cover-grid">
          <article className="cover-card">
            <h2>Corpus Graph</h2>
            <p>
              Six canonical texts — Meditations, Enchiridion, Beyond Good and Evil, The Republic,
              Inferno, Ethics — connected by curated reference edges: influence, response,
              allusion, commentary.
            </p>
          </article>
          <article className="cover-card">
            <h2>Canonical Passage Model</h2>
            <p>
              Every text is chunked into stable, addressable passage units. Annotations anchor
              to character offsets with exact/prefix/suffix selectors so they survive minor
              text edits.
            </p>
          </article>
          <article className="cover-card">
            <h2>Threaded Annotation</h2>
            <p>
              Highlight any passage to open a thread. Replies nest underneath. Threads can be
              closed. A global Traces view surfaces the most active threads by attention score.
            </p>
          </article>
          <article className="cover-card">
            <h2>My Trail</h2>
            <p>
              Every OPEN_WORK, OPEN_PASSAGE, ANNOTATE, and REPLY event is recorded. Your trail
              is a persistent, browseable route through the corpus — switch users to see
              how different readers move.
            </p>
          </article>
          <article className="cover-card">
            <h2>Graph Projection API</h2>
            <p>
              <code>/api/graph</code> returns a D3/Cytoscape-ready payload: corpus nodes with
              degree + attention scores, reference edges with relation types, annotation nodes
              and reply edges.
            </p>
          </article>
          <article className="cover-card">
            <h2>Two Demo Users</h2>
            <p>
              Switch between <strong>alice</strong> and <strong>bob</strong> to see pre-seeded
              cross-reader discussions — Nietzsche vs. Aurelius, Plato vs. Spinoza, the Stoic
              self-overcoming debate.
            </p>
          </article>
        </section>

        <div className="cover-actions">
          <Link className="cover-primary" href="/demo">
            Open Interactive Demo →
          </Link>
        </div>
      </div>
    </main>
  );
}
