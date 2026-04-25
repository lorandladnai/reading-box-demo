// All DTOs for Reading Box. No Record<string, unknown> anywhere.
// Shapes are derived directly from API route return values.

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

// Sub-types extracted from ReaderDto for component prop signatures
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

export type PassageDto = {
  id: string;
  passageIndex: number;
  text: string;
  sectionKey: string;
};

export type ReaderDto = {
  id: string;
  work: { id: string; title: string; authors: string[] };
  passages: PassageDto[];
  annotations: InlineAnnotationDto[];
};

// Derived from GET /api/annotations (includes replies + edition.work join)
export type AnnotationDto = {
  id: string;
  body: string;
  state: "OPEN" | "CLOSED";
  passageId: string;
  editionId: string;
  workId: string;
  userName: string;
  attention: number;
  replies: ReplyDto[];
};

// Derived from GET /api/trail (includes work + passage joins)
export type TrailEventDto = {
  id: string;
  userId: string;
  workId: string;
  editionId: string;
  passageId: string | null;
  eventType: "OPEN_WORK" | "OPEN_PASSAGE" | "ANNOTATE" | "REPLY";
  visibility: "PUBLIC" | "PRIVATE";
  createdAt: string;
  work: { id: string; title: string };
};

// Shared selection state used in PassageReader
export type SelectionState = {
  start: number;
  end: number;
  exact: string;
};
