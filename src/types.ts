export type PaperCollectorConfig = {
  databaseId: string;
  parentPageId: string;
};

export type PaperMetadata = {
  title: string;
  authors: string;
  institutions: string[];
  publishedDate: string;
  sourceUrl: string;
  paperUrl: string;
  summary: string;
  contributions: string;
  tags: string[];
  conference: string;
  status: "Unread" | "Reading" | "Read";
  notes: string;
};

export type BatchSaveResult = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{
    title: string;
    status: "saved" | "duplicate" | "failed";
    pageId?: string;
    url?: string;
    error?: string;
  }>;
};
