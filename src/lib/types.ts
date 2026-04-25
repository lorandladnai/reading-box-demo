// ----------------------------------------------------------------
// Shared sub-types
// ----------------------------------------------------------------

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

export type SelectionState = {
  start: number;
  end: number;
  exact: string;
};

// ----------------------------------------------------------------
// API DTOs
// ----------------------------------------------------------------

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

export type ReaderDto = {
  id: string;
  work: { id: string; title: string; authors: string[] };
  passages: PassageDto[];
  annotations: InlineAnnotationDto[];
};

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

export type TrailEventDto = {
  id: string;
  eventType: string;
  workId: string;
  editionId: string;
  passageId: string | null;
  userId: string;
  createdAt: string;
  work: { title: string };
};
