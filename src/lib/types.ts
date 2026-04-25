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

export type AnnotationDto = {
  id: string;
  body: string;
  state: "OPEN" | "CLOSED";
  passageId: string;
  userName: string;
  startOffset: number;
  endOffset: number;
  exact: string;
  replies: Array<{ id: string; body: string; userName: string }>;
};

export type ReaderDto = {
  id: string;
  work: { id: string; title: string; authors: string[] };
  passages: Array<{ id: string; passageIndex: number; text: string; sectionKey: string }>;
  annotations: AnnotationDto[];
  totalPassages: number;
  page: number;
  pageSize: number;
};
