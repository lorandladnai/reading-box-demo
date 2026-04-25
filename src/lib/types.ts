// ─── Work / Corpus ────────────────────────────────────────────
export type WorkDto = {
  id: string;
  slug: string;
  title: string;
  authors: string[];
  subjects: string[];
  editionId: string | null;
  references: Array<{ targetWorkId: string; targetTitle: string; relation: string }>;
  citedBy: Array<{ sourceWorkId: string; sourceTitle: string; relation: string }>;
};

// ─── Reader / Passages ────────────────────────────────────────
export type PassageDto = {
  id: string;
  passageIndex: number;
  text: string;
  sectionKey: string;
};

export type ReplyDto = {
  id: string;
  body: string;
  userName: string;
};

export type InlineAnnotationDto = {
  id: string;
  body: string;
  state: "OPEN" | "CLOSED";
  passageId: string;
  userName: string;
  replies: ReplyDto[];
};

export type ReaderDto = {
  id: string;
  work: { id: string; title: string; authors: string[] };
  passages: PassageDto[];
  annotations: InlineAnnotationDto[];
};

// ─── Selection ────────────────────────────────────────────────
export type SelectionState = {
  start: number;
  end: number;
  exact: string;
};

// ─── Global Annotations Feed ─────────────────────────────────
export type AnnotationDto = {
  id: string;
  body: string;
  state: "OPEN" | "CLOSED";
  passageId: string;
  userName: string;
  workId: string;
  editionId: string;
  replies: ReplyDto[];
};

// ─── Trail ───────────────────────────────────────────────────
export type TrailEventDto = {
  id: string;
  eventType: "OPEN_WORK" | "OPEN_PASSAGE" | "ANNOTATE" | "REPLY";
  workId: string;
  editionId: string;
  passageId: string | null;
  userId: string;
  createdAt: string;
  work: { title: string };
};
