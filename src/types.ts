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
  status: "Unread" | "Reading" | "Read";
};
